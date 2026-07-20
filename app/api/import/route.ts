// ▸ Replace: app/api/import/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'
import { logError } from '@/lib/log-error'
import { normalizeArtists, normalizeTitle, similarity } from '@/lib/track-match'

// ── Types ─────────────────────────────────────────────────────
interface RawTrack {
  id?:     string
  title:   string
  artist:  string
  bpm?:    number
  key?:    string
  genre?:  string
  path?:   string
}

// ══════════════════════════════════════════════════════════════
// SMART PRE-FILTER
// Reduces any crate (up to 500 tracks) down to ≤30 high-quality
// candidates before touching the AI. This is the core optimization —
// the AI never sees more than 30 tracks per call.
// ══════════════════════════════════════════════════════════════
function smartPrefilter(
  tracks:    RawTrack[],
  bpmLow:    number,
  bpmHigh:   number,
  targetSet: number,     // how many tracks the user wants in the final set
  maxCandidates = 30,
): RawTrack[] {

  // 1. Deduplicate: same lowercase artist + title
  const seen  = new Set<string>()
  const deduped = tracks.filter(t => {
    const key = `${t.artist.toLowerCase().trim()}::${t.title.toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })

  // 2. BPM filter — generous ±12 BPM around the requested range
  const bpmMin = bpmLow  - 12
  const bpmMax = bpmHigh + 12
  const bpmFiltered = deduped.filter(t => !t.bpm || (t.bpm >= bpmMin && t.bpm <= bpmMax))

  // 3. Score each track — higher = more useful to the AI
  const scored = bpmFiltered.map(t => {
    let score = 0
    if (t.bpm) {
      score += 10
      // Bonus if BPM is squarely in the requested range
      if (t.bpm >= bpmLow && t.bpm <= bpmHigh) score += 5
    }
    if (t.key)   score += 8   // harmonic data is very valuable
    if (t.genre) score += 2
    return { ...t, _score: score }
  })

  // 4. Artist diversity cap — max 3 tracks per artist
  // Sort by score first so we keep the best 3 per artist
  scored.sort((a, b) => b._score - a._score)
  const artistCount: Record<string, number> = {}
  const diverse = scored.filter(t => {
    const artist = t.artist.toLowerCase().trim()
    artistCount[artist] = (artistCount[artist] || 0) + 1
    return artistCount[artist] <= 3
  })

  // 5. Ensure we have more candidates than the target set (ideally 2x)
  const needed = Math.max(targetSet * 2, maxCandidates)

  // 6. If we have more than needed, sample across BPM range to ensure variety
  if (diverse.length > needed) {
    // Divide BPM range into 5 buckets, take proportional samples
    const withBpm    = diverse.filter(t => t.bpm)
    const withoutBpm = diverse.filter(t => !t.bpm)
    const bucketSize = (bpmHigh - bpmLow) / 5 || 1
    const buckets: RawTrack[][] = Array.from({ length: 5 }, () => [])

    withBpm.forEach(t => {
      const b = Math.min(4, Math.floor((t.bpm! - bpmLow) / bucketSize))
      buckets[Math.max(0, b)].push(t)
    })

    const sampled: RawTrack[] = []
    const perBucket = Math.floor(needed * 0.8 / 5)
    buckets.forEach(bucket => {
      // Fisher-Yates shuffle within each bucket
      const b = [...bucket]
      for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [b[i], b[j]] = [b[j], b[i]]
      }
      sampled.push(...b.slice(0, Math.max(perBucket, 3)))
    })

    // Fill remaining slots from trackless candidates
    const remaining = Math.max(0, needed - sampled.length)
    sampled.push(...withoutBpm.slice(0, remaining))

    return sampled.slice(0, needed)
  }

  return diverse
}

// ══════════════════════════════════════════════════════════════
// SINGLE CHUNK GENERATOR
// Calls Claude with ≤15 tracks max. Used for both small sets
// and as the building block for chunked large sets.
// ══════════════════════════════════════════════════════════════
async function generateChunk(params: {
  tracks:      RawTrack[]
  bpmLow:      number
  bpmHigh:     number
  keyMatch:    boolean
  targetCount: number
  energyStart: number   // target energy level at start of this chunk (1-10)
  energyEnd:   number   // target energy level at end of this chunk (1-10)
  position:    'opening' | 'middle' | 'closing'
  prevTracks?: RawTrack[] // last 2 tracks of the previous chunk (for continuity)
  setTitle?:   string
}): Promise<{ title: string; summary: string; tracks: RawTrack[] }> {

  const { tracks, bpmLow, bpmHigh, keyMatch, targetCount, energyStart, energyEnd, position, prevTracks, setTitle } = params

  const trackList = tracks.map((t, i) =>
    `${i + 1}. "${t.artist} — ${t.title}"${t.bpm ? ` [${t.bpm} BPM]` : ''}${t.key ? ` [${t.key}]` : ''}`
  ).join('\n')

  const contextLine = prevTracks?.length
    ? `\nThe previous chunk ended with:\n${prevTracks.map(t => `  - "${t.artist} — ${t.title}"${t.bpm ? ` [${t.bpm} BPM]` : ''}${t.key ? ` [${t.key}]` : ''}`).join('\n')}\nThe first track of your output MUST flow naturally from these.\n`
    : ''

  const positionGuide = {
    opening: 'Start with lower energy tracks and build up gradually.',
    middle:  'Maintain or build energy — this is the heart of the set.',
    closing: position === 'closing' && energyEnd < energyStart
      ? 'Energy should peak then start to wind down toward the end.'
      : 'Peak energy — give everything here.',
  }[position]

  const prompt = `You are a world-class DJ. Choose and ORDER tracks for the ${position} section of a DJ set.

Available tracks (choose exactly ${targetCount} from this list — do not invent new ones):
${trackList}
${contextLine}
Requirements:
- Select EXACTLY ${targetCount} tracks from the list above
- BPM range: ${bpmLow}–${bpmHigh} BPM
- Energy: start around ${energyStart}/10, end around ${energyEnd}/10
- ${positionGuide}
- ${keyMatch ? 'Adjacent Camelot keys MUST be compatible (same number, ±1, or A↔B same number)' : 'No key constraint'}
- Write a short transition note for each track explaining how to mix into the next one

Respond ONLY with valid JSON, no markdown:
{
  "title": ${setTitle ? `"${setTitle}"` : '"short evocative set name"'},
  "summary": "1 sentence about the energy journey of this chunk",
  "tracks": [
    { "n": 1, "artist": "Artist Name", "title": "Track Title", "bpm": 124, "key": "8A", "energy": 4, "transition": "mix note into the next track" }
  ]
}`

  const msg = await anthropic.messages.create({
    model:      CLAUDE_MODEL,
    max_tokens: 3000,
    messages:   [{ role: 'user', content: prompt }],
  })

  const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ══════════════════════════════════════════════════════════════
// INTERPOLATE ENERGY CURVE
// Maps a 5-point energy curve to any number of tracks
// ══════════════════════════════════════════════════════════════
function interpolateEnergy(points: number[], n: number): number[] {
  if (n <= 1) return [points[2]]
  return Array.from({ length: n }, (_, i) => {
    const t    = i / (n - 1)
    const seg  = t * (points.length - 1)
    const lo   = Math.floor(seg)
    const hi   = Math.min(points.length - 1, lo + 1)
    return Math.round(points[lo] + (points[hi] - points[lo]) * (seg - lo))
  })
}

// ══════════════════════════════════════════════════════════════
// RE-ATTACH FILE PATHS
// The AI only ever sees artist/title/bpm/key text, so it never echoes
// back the Location/DIR+FILE path the user's DJ software export carried.
// Match the AI's chosen tracks back to the original import list to
// restore it — exact normalized match first, fuzzy fallback for any
// punctuation/casing the model reformatted.
// ══════════════════════════════════════════════════════════════
function attachPaths(tracks: RawTrack[], source: RawTrack[]): RawTrack[] {
  const byKey = new Map<string, RawTrack>()
  source.forEach(t => byKey.set(`${t.artist.toLowerCase().trim()}::${t.title.toLowerCase().trim()}`, t))

  return tracks.map(t => {
    const exact = byKey.get(`${t.artist.toLowerCase().trim()}::${t.title.toLowerCase().trim()}`)
    if (exact?.path) return { ...t, path: exact.path }

    const qTitle  = normalizeTitle(t.title)
    const qArtist = normalizeArtists(t.artist)
    let best: { path: string; score: number } | null = null
    for (const s of source) {
      if (!s.path) continue
      const titleSim  = similarity(normalizeTitle(s.title), qTitle)
      const artistSim = Math.max(0, ...normalizeArtists(s.artist).flatMap(a => qArtist.map(q => similarity(a, q))))
      const score = titleSim * 0.6 + artistSim * 0.4
      if (score > 0.82 && (!best || score > best.score)) best = { path: s.path, score }
    }
    return best ? { ...t, path: best.path } : t
  })
}

// ══════════════════════════════════════════════════════════════
// MAIN ROUTE
// ══════════════════════════════════════════════════════════════
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({
        error: sub.isFree
          ? "You've used all 5 free sets this month. Upgrade to Pro for a lot more."
          : "You've hit this month's generation cap. It resets on the 1st — need more sooner? Reach out via feedback.",
        code: 'LIMIT_REACHED', isFree: sub.isFree,
      }, { status: 429 })
    }

    const {
      tracks: rawTracks = [],
      bpmLow    = 120,
      bpmHigh   = 128,
      keyMatch  = true,
      minutes   = 60,
      mode      = 'time',
      count,
      energyPoints,
    } = await req.json()

    if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided.' }, { status: 400 })
    }

    // How many tracks does the user want?
    const targetTracks = mode === 'count'
      ? Math.min(count || 12, sub.isFree ? 15 : 50)
      : Math.min(Math.round(minutes / 4.5), sub.isFree ? 15 : 50)

    // ── Step 1: Smart pre-filter ──────────────────────────────
    const candidates = smartPrefilter(rawTracks, bpmLow, bpmHigh, targetTracks)

    if (candidates.length === 0) {
      return NextResponse.json({
        error: `No tracks found in the BPM range ${bpmLow}–${bpmHigh}. Try widening your BPM range or selecting a different crate.`,
      }, { status: 400 })
    }

    // Energy curve for this set
    const energyCurve = energyPoints?.length === 5
      ? interpolateEnergy(energyPoints, targetTracks)
      : interpolateEnergy([3, 5, 7, 9, 8], targetTracks)

    // ── Step 2: Generate — single call or chunked ─────────────
    let finalSet: { title: string; summary: string; tracks: RawTrack[] }

    const CHUNK_SIZE = 13   // max tracks per AI call

    if (targetTracks <= CHUNK_SIZE) {
      // ── Single call ──────────────────────────────────────────
      finalSet = await generateChunk({
        tracks:      candidates,
        bpmLow, bpmHigh, keyMatch,
        targetCount: targetTracks,
        energyStart: energyCurve[0],
        energyEnd:   energyCurve[energyCurve.length - 1],
        position:    'opening',
      })

    } else {
      // ── Two-chunk approach ───────────────────────────────────
      const chunk1Size = CHUNK_SIZE
      const chunk2Size = targetTracks - chunk1Size

      // Split energy curve
      const energy1 = energyCurve.slice(0, chunk1Size)
      const energy2 = energyCurve.slice(chunk1Size)

      // Shuffle candidates so chunks get different track pools
      const shuffled = [...candidates]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }

      // Give each chunk a overlapping pool
      const pool1 = shuffled.slice(0, Math.min(shuffled.length, 22))
      const pool2 = shuffled.slice(Math.max(0, shuffled.length - 22))

      // Generate chunk 1
      const chunk1Result = await generateChunk({
        tracks:      pool1,
        bpmLow, bpmHigh, keyMatch,
        targetCount: chunk1Size,
        energyStart: energy1[0],
        energyEnd:   energy1[energy1.length - 1],
        position:    'opening',
      })

      // Generate chunk 2, seeded with last 2 tracks of chunk 1
      const prevTracks = (chunk1Result.tracks || []).slice(-2)
      const chunk2Result = await generateChunk({
        tracks:      pool2,
        bpmLow, bpmHigh, keyMatch,
        targetCount: chunk2Size,
        energyStart: energy2[0],
        energyEnd:   energy2[energy2.length - 1],
        position:    'closing',
        prevTracks,
        setTitle:    chunk1Result.title,
      })

      // Stitch chunks — renumber the closing chunk
      const chunk2Tracks = (chunk2Result.tracks || []).map((t, i) => ({
        ...t, n: chunk1Size + i + 1,
      }))

      finalSet = {
        title:   chunk1Result.title,
        summary: chunk1Result.summary,
        tracks:  [...(chunk1Result.tracks || []), ...chunk2Tracks],
      }
    }

    finalSet.tracks = attachPaths(finalSet.tracks, rawTracks)

    await recordUsage(userId, 'generate')

    return NextResponse.json({
      set: finalSet,
      quota: {
        tier:      sub.tier,
        remaining: sub.remainingGenerations === null ? 'unlimited' : sub.remainingGenerations - 1,
        trial:     sub.trial ?? null,
        isFree:    sub.isFree ?? false,
      },
    })

  } catch (err: unknown) {
    logError('[POST /api/import]', err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}