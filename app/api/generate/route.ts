// ▸ Replace: app/api/generate/route.ts

import { auth }         from '@clerk/nextjs/server'

// Extend Vercel timeout to 120s for large chunked sets
export const maxDuration = 120
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'
import { enrichTracks, type EnrichableTrack } from '@/lib/track-enrichment'
import { getTrendingTracksForGenre, type TrendingTrack } from '@/lib/trending'
import { logError } from '@/lib/log-error'

// ── Energy interpolation ──────────────────────────────────────
function interpolateEnergy(points: number[], n: number): number[] {
  if (n <= 1) return [points[2]]
  return Array.from({ length: n }, (_, i) => {
    const t   = i / (n - 1)
    const seg = t * (points.length - 1)
    const lo  = Math.floor(seg)
    const hi  = Math.min(points.length - 1, lo + 1)
    return Math.round(points[lo] + (points[hi] - points[lo]) * (seg - lo))
  })
}

// ── Locked track injection ────────────────────────────────────
function buildLockedSection(lockedTracks: { n:number; artist:string; title:string; bpm:number; key:string; energy:number }[]): string {
  if (!lockedTracks?.length) return ''
  const list = lockedTracks.map(t =>
    `  Position ${t.n}: "${t.artist} — ${t.title}" (${t.bpm} BPM, ${t.key}, energy ${t.energy}) — KEEP EXACTLY`
  ).join('\n')
  return `\n\nLOCKED TRACKS (reproduce unchanged at their exact positions — build around them):\n${list}`
}

// ══════════════════════════════════════════════════════════════
// SINGLE-CHUNK PROMPT
// Used for sets ≤ 13 tracks, or as each chunk in a large set
// ══════════════════════════════════════════════════════════════
// ── Familiarity → instruction text ─────────────────────────────
function familiarityInstruction(familiarity?: string): string {
  switch (familiarity) {
    case 'Popular Hits':
      return 'Favor widely recognizable, well-known tracks and festival/radio staples for this genre — the crowd should recognize most of the set.'
    case 'Deep Cuts / Underground':
      return 'Favor lesser-known, underground, or deep-cut tracks — avoid the most obvious/overplayed picks even where they would fit. Crate-digger selections.'
    default:
      return 'Mix well-known tracks with some lesser-known picks — a natural blend of familiar and fresh.'
  }
}

async function generateChunk(params: {
  genre:        string
  crowd:        string
  familiarity:  string
  vibe:         string
  refArtist:    string
  bpmLow:       number
  bpmHigh:      number
  keyMatch:     boolean
  targetCount:  number
  energyStart:  number
  energyEnd:    number
  energyCurve:  number[]
  position:          'full' | 'opening' | 'closing'
  includeMixingNotes?: boolean
  lockedTracks?: { n:number; artist:string; title:string; bpm:number; key:string; energy:number }[]
  prevTracks?:  { artist:string; title:string; bpm:number; key:string }[]
  setTitle?:    string
  recentTracks?: string[]
  libraryTracks?: { artist:string; title:string; bpm?:number; key?:string }[]
  trendingTracks?: TrendingTrack[]
}): Promise<{ title: string; summary: string; tracks: unknown[] }> {

  const {
    genre, crowd, familiarity, vibe, refArtist,
    bpmLow, bpmHigh, keyMatch,
    targetCount, energyStart, energyEnd, energyCurve,
    position, includeMixingNotes = true, lockedTracks, prevTracks, setTitle, recentTracks = [],
    libraryTracks = [], trendingTracks = [],
  } = params

  const vibeLine    = vibe?.trim()      ? `\n- Vibe / mood: ${vibe.trim()}`              : ''
  const refLine     = refArtist?.trim() ? `\n- Reference artists: ${refArtist.trim()}`   : ''
  const lockedBlock = buildLockedSection(lockedTracks || [])

  const curveStr = energyCurve.map((e, i) => `Track ${i + 1}: energy ${e}/10`).join(', ')

  // FIX 1+2: Build avoid list from recent tracks + locked to prevent duplicates
  const allLockedTitles = (lockedTracks || []).map(t => `"${t.artist} — ${t.title}"`)
  const avoidList = [...new Set([...recentTracks, ...allLockedTitles])]
  const avoidBlock = avoidList.length
    ? `\n\nDO NOT USE any of these tracks (already used in this or recent sets):\n${avoidList.slice(0, 40).join('\n')}`
    : ''

  const contextBlock = prevTracks?.length
    ? `\nThis chunk continues from: ${prevTracks.map(t => `"${t.artist} — ${t.title}" [${t.bpm} BPM, ${t.key}]`).join(' → ')}. First track MUST flow naturally from these.\n`
    : ''

  const positionNote = {
    full:    '',
    opening: '\nThis is the OPENING section — start low energy, build gradually.',
    closing: '\nThis is the CLOSING section — follow the energy curve to the end.',
  }[position]

  const libraryBlock = libraryTracks.length
    ? `\n\nPREFERRED TRACKS from this DJ's personal library — prioritize these where they fit the BPM range, energy, key, and genre requirements:\n${
        libraryTracks.slice(0, 50).map(t => `- "${t.artist} — ${t.title}"${t.bpm ? ` [${t.bpm} BPM]` : ''}${t.key ? ` [${t.key}]` : ''}`).join('\n')
      }\nUse library tracks over equivalent alternatives when they fit. Supplement with other real tracks when the library lacks a suitable option for a slot.`
    : ''

  const trendingBlock = trendingTracks.length
    ? `\n\nTRENDING NOW in ${genre} (real tracks currently popular on genre charts — use several where they fit, to keep the set feeling current rather than leaning only on older well-known tracks):\n${
        trendingTracks.slice(0, 20).map(t => `- "${t.artist} — ${t.title}"${t.bpm ? ` [${t.bpm} BPM]` : ''}${t.key ? ` [${t.key}]` : ''}`).join('\n')
      }`
    : ''

  // Illustrative key/BPM used in the schema example and rules text below are randomized
  // per request — a fixed example (e.g. always "8A") measurably biases the model toward
  // reproducing that exact value and its neighbors across generated sets.
  const exNum    = 1 + Math.floor(Math.random() * 12)
  const exLetter = Math.random() < 0.5 ? 'A' : 'B'
  const exKey    = `${exNum}${exLetter}`
  const exRelKey = `${exNum}${exLetter === 'A' ? 'B' : 'A'}`
  const exDownNum = exNum === 1 ? 12 : exNum - 1
  const exUpNum   = exNum === 12 ? 1 : exNum + 1
  const exBpm     = Math.round(bpmLow + Math.random() * Math.max(0, bpmHigh - bpmLow))

  const prompt = `You are a world-class DJ set curator. Build a ${position === 'full' ? 'complete' : position} DJ set section.

Parameters:
- Genre: ${genre}
- Crowd: ${crowd}${vibeLine}${refLine}
- Track familiarity: ${familiarityInstruction(familiarity)}
- BPM range: ${bpmLow}–${bpmHigh}
- Harmonic key matching: ${keyMatch ? 'YES — adjacent Camelot keys must be compatible (same number, ±1, or A↔B)' : 'not required'}
- Track count: ${targetCount} tracks
- Energy: start ${energyStart}/10 → end ${energyEnd}/10
- Custom energy per position: ${curveStr}${positionNote}${contextBlock}${lockedBlock}${avoidBlock}${libraryBlock}${trendingBlock}

Respond ONLY with valid JSON, no markdown, no preamble (the field values below are placeholder illustrations, not suggested values):
{
  "title": ${setTitle ? `"${setTitle}"` : '"evocative set name (3–5 words)"'},
  "summary": "1 sentence describing the energy journey",
  "tracks": [
    ${includeMixingNotes
      ? `{ "n": 1, "artist": "Artist", "title": "Title", "bpm": ${exBpm}, "key": "${exKey}", "energy": 4, "transition": "mix note into next track" }`
      : `{ "n": 1, "artist": "Artist", "title": "Title", "bpm": ${exBpm}, "key": "${exKey}", "energy": 4 }`}
  ]
}

Rules:
- Pick REAL tracks that DEFINITIVELY exist on Spotify and Beatport — commercial releases by established artists only
- NEVER suggest: unreleased tracks, dubplates, SoundCloud-only tracks, bootlegs, unofficial edits, or tracks you are uncertain about
- If you cannot fill the track count with verified streaming tracks, use fewer tracks rather than inventing or guessing
- Match each track's energy to the per-position value above
- Use the FULL range of Camelot key numbers (1–12) and BPM values across the set based on what genuinely fits each real track — do NOT default to any one key or gravitate toward the same 2–3 keys out of habit; a set that never leaves one or two key numbers is a bug, not a feature
- ${keyMatch ? `Harmonic key mixing REQUIRED. Camelot wheel rules (strict, using N as a generic position 1–12):
  · Each position NA (minor) pairs with NB (major): same number is always compatible (e.g. ${exKey}↔${exRelKey})
  · Adjacent on same ring: (N-1)X↔NX↔(N+1)X where 12 wraps to 1 (12A↔1A, 12B↔1B)
  · Compatible moves FROM ${exKey}: → ${exRelKey} (relative), → ${exDownNum}${exLetter} (down), → ${exUpNum}${exLetter} (up). Nothing else.
  · DO NOT skip positions — jumping more than one position on the wheel is a key clash, not harmonic
  · BPM difference between adjacent tracks must be ≤ 6 BPM for smooth mixing` : 'Key matching off — focus on BPM and energy flow'}
${includeMixingNotes ? '- Transition notes should be specific (e.g. "filter sweep on the breakdown, swap kicks at the drop")' : '- Do NOT include a "transition" field — omit it entirely for faster, tracklist-only output'}
- If locked tracks are specified, reproduce them EXACTLY at their positions`

  const msg = await anthropic.messages.create({
    model:      CLAUDE_MODEL,
    max_tokens: 3000,
    messages:   [{ role: 'user', content: prompt }],
  })

  const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ══════════════════════════════════════════════════════════════
// SINGLE-TRACK REPLACEMENT
// Used when a generated track fails existence verification (likely
// hallucinated) — asks for exactly one confirmed-real substitute.
// ══════════════════════════════════════════════════════════════
type ReplaceableTrack = { artist: string; title: string; bpm: number; key: string; energy: number; transition?: string }

async function regenerateTrack(params: {
  genre: string; crowd: string; vibe: string; refArtist: string
  bpmLow: number; bpmHigh: number; keyMatch: boolean
  target: ReplaceableTrack
  prevTrack?: { artist: string; title: string; bpm: number; key: string } | null
  nextTrack?: { artist: string; title: string; bpm: number; key: string } | null
  avoidList: string[]
  includeMixingNotes: boolean
}): Promise<ReplaceableTrack | null> {
  const { genre, crowd, vibe, refArtist, bpmLow, bpmHigh, keyMatch, target, prevTrack, nextTrack, avoidList, includeMixingNotes } = params

  const prompt = `You are a world-class DJ. A track suggested for a DJ set could not be confirmed as a real, existing release and must be replaced with exactly ONE different real track.

Set context:
- Genre: ${genre} | Crowd: ${crowd}${vibe ? ` | Vibe: ${vibe}` : ''}${refArtist ? ` | Ref: ${refArtist}` : ''}
- BPM range: ${bpmLow}–${bpmHigh} | Harmonic key matching: ${keyMatch ? 'yes' : 'no'}

Replace: "${target.artist} — ${target.title}" (${target.bpm} BPM, ${target.key}, energy ${target.energy}/10)
${prevTrack ? `Previous track: "${prevTrack.artist} — ${prevTrack.title}" (${prevTrack.bpm} BPM, ${prevTrack.key})` : 'This is the first track.'}
${nextTrack ? `Next track: "${nextTrack.artist} — ${nextTrack.title}" (${nextTrack.bpm} BPM, ${nextTrack.key})` : 'This is the last track.'}

DO NOT suggest any of these (already in the set): ${avoidList.join(', ')}

This is critical: the previous suggestion failed because it couldn't be found on Spotify or Beatport. Pick something you are highly confident is a real, well-known, commercially released track.

Respond ONLY with valid JSON, no markdown:
{ "artist": "...", "title": "...", "bpm": <integer within ${bpmLow}-${bpmHigh}>, "key": "Camelot key e.g. 8A", "energy": ${target.energy}${includeMixingNotes ? ', "transition": "short mix note into next track"' : ''} }`

  const msg = await anthropic.messages.create({
    model:      CLAUDE_MODEL,
    max_tokens: 400,
    messages:   [{ role: 'user', content: prompt }],
  })

  const raw  = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const data = JSON.parse(raw.replace(/```json|```/g, '').trim())
  if (!data?.artist || !data?.title) return null

  return {
    artist:     data.artist,
    title:      data.title,
    bpm:        Math.round(data.bpm) || target.bpm,
    key:        data.key || target.key,
    energy:     data.energy ?? target.energy,
    ...(includeMixingNotes ? { transition: data.transition } : {}),
  }
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
          ? "You've used all 5 free sets this month. Upgrade to Pro for unlimited sets."
          : `Monthly limit reached. Upgrade for unlimited sets.`,
        code: 'LIMIT_REACHED', isFree: sub.isFree,
      }, { status: 429 })
    }

    const body = await req.json()
    const {
      genre, crowd, familiarity, vibe, refArtist,
      mode, minutes, count,
      bpmLow = 120, bpmHigh = 128,
      keyMatch = true,
      lockedTracks = [],
      energyPoints,
      includeMixingNotes = true,
      recentTracks = [],
      libraryTracks = [],
    } = body

    if (!genre || !crowd) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    if (typeof genre !== 'string' || genre.length > 120) {
      return NextResponse.json({ error: 'Genre must be under 120 characters.' }, { status: 400 })
    }

    // How many tracks?
    const MAX_TRACKS = sub.isFree ? 15 : 50
    const targetTracks = Math.min(
      mode === 'count' ? (count || 12) : Math.round((minutes || 60) / 4.5),
      MAX_TRACKS,
    )

    // Energy curve — the client always sends a real, hand-shaped curve (one point
    // per track, via the interactive editor); this default only covers malformed
    // or missing input, not a named "arc" — a gentle build works for any genre.
    const DEFAULT_CURVE = [3, 5, 6, 8, 9]
    const energyCurve = interpolateEnergy(
      Array.isArray(energyPoints) && energyPoints.length >= 2 ? energyPoints : DEFAULT_CURVE,
      targetTracks,
    )

    const baseParams = { genre, crowd, familiarity: familiarity || 'Balanced Mix', vibe: vibe||'', refArtist: refArtist||'', bpmLow, bpmHigh, keyMatch }

    const trendingTracks = await getTrendingTracksForGenre(genre)

    const CHUNK_SIZE = 13

    let finalSet: { title: string; summary: string; tracks: unknown[] }

    if (targetTracks <= CHUNK_SIZE) {
      // ── Single call ──────────────────────────────────────────
      finalSet = await generateChunk({
        ...baseParams,
        targetCount:  targetTracks,
        energyStart:  energyCurve[0],
        energyEnd:    energyCurve[energyCurve.length - 1],
        energyCurve,
        position:     'full',
        lockedTracks,
        includeMixingNotes,
        recentTracks,
        libraryTracks,
        trendingTracks,
      })

    } else {
      // ── Two-chunk approach ───────────────────────────────────
      // Split locked tracks into the chunk they belong to
      const chunk1Size = CHUNK_SIZE
      const chunk2Size = targetTracks - chunk1Size

      const locked1 = lockedTracks.filter((t: { n: number }) => t.n <= chunk1Size)
      const locked2 = lockedTracks
        .filter((t: { n: number }) => t.n > chunk1Size)
        .map((t: { n: number; artist:string; title:string; bpm:number; key:string; energy:number }) => ({ ...t, n: t.n - chunk1Size }))

      const energy1 = energyCurve.slice(0, chunk1Size)
      const energy2 = energyCurve.slice(chunk1Size)

      // Chunk 1: opening
      const chunk1 = await generateChunk({
        ...baseParams,
        targetCount:  chunk1Size,
        energyStart:  energy1[0],
        energyEnd:    energy1[energy1.length - 1],
        energyCurve:  energy1,
        position:     'opening',
        lockedTracks: locked1,
        includeMixingNotes,
        recentTracks,
        libraryTracks,
        trendingTracks,
      })

      // Chunk 2: closing, seeded from chunk 1's last 2 tracks
      const prevTracks = ((chunk1.tracks || []) as { artist:string; title:string; bpm:number; key:string }[]).slice(-2)
      // Pass chunk 1 tracks as recent so chunk 2 never repeats them
      const chunk1Used = ((chunk1.tracks || []) as {artist:string;title:string}[])
        .map(t => `"${t.artist} — ${t.title}"`)
      const chunk2 = await generateChunk({
        ...baseParams,
        targetCount:  chunk2Size,
        energyStart:  energy2[0],
        energyEnd:    energy2[energy2.length - 1],
        energyCurve:  energy2,
        position:     'closing',
        lockedTracks: locked2,
        prevTracks,
        setTitle:     chunk1.title,
        includeMixingNotes,
        recentTracks: [...recentTracks, ...chunk1Used],
        libraryTracks,
        trendingTracks,
      })

      // Renumber chunk 2 tracks
      const chunk2Tracks = ((chunk2.tracks || []) as { n: number }[]).map((t, i) => ({
        ...t, n: chunk1Size + i + 1,
      }))

      finalSet = {
        title:   chunk1.title,
        summary: chunk1.summary,
        tracks:  [...(chunk1.tracks || []), ...chunk2Tracks],
      }
    }

    await recordUsage(userId, 'generate')

    const tracksArr = finalSet.tracks as (EnrichableTrack & { n: number; energy: number; transition?: string })[]

    try {
      await enrichTracks(tracksArr)
    } catch (err) {
      console.warn('[generate] metadata enrichment failed, keeping AI-guessed values', err)
    }

    // Tracks Spotify actively couldn't find are likely hallucinated — try one
    // real replacement per slot before giving up and just flagging it.
    const unverifiedIndices = tracksArr
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.verified === false)
      .map(({ i }) => i)

    if (unverifiedIndices.length) {
      const avoidList = tracksArr.map(t => `"${t.artist} — ${t.title}"`)
      await Promise.all(unverifiedIndices.map(async (i) => {
        const target = tracksArr[i]
        try {
          const replacement = await regenerateTrack({
            genre, crowd, vibe: vibe || '', refArtist: refArtist || '', bpmLow, bpmHigh, keyMatch,
            target, prevTrack: tracksArr[i - 1] ?? null, nextTrack: tracksArr[i + 1] ?? null,
            avoidList, includeMixingNotes,
          })
          if (!replacement) return // tracksArr[i].verified is already false

          const replacementArr: EnrichableTrack[] = [{ ...replacement }]
          await enrichTracks(replacementArr)

          if (replacementArr[0].verified) {
            tracksArr[i] = { ...target, ...replacementArr[0], n: target.n }
          } // else: replacement also unverifiable — keep the original guess, still flagged false
        } catch (err) {
          console.warn('[generate] replacement attempt failed for unverified track', err)
        }
      }))
    }

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
    logError('[POST /api/generate]', err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
