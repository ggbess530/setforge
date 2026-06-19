// ▸ Replace: app/api/generate/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'

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
async function generateChunk(params: {
  genre:        string
  crowd:        string
  vibe:         string
  refArtist:    string
  bpmLow:       number
  bpmHigh:      number
  keyMatch:     boolean
  targetCount:  number
  energyStart:  number
  energyEnd:    number
  energyCurve:  number[]  // full energy values per track position
  position:     'full' | 'opening' | 'closing'
  lockedTracks?: { n:number; artist:string; title:string; bpm:number; key:string; energy:number }[]
  prevTracks?:  { artist:string; title:string; bpm:number; key:string }[]
  setTitle?:    string
}): Promise<{ title: string; summary: string; tracks: unknown[] }> {

  const {
    genre, crowd, vibe, refArtist,
    bpmLow, bpmHigh, keyMatch,
    targetCount, energyStart, energyEnd, energyCurve,
    position, lockedTracks, prevTracks, setTitle,
  } = params

  const vibeLine    = vibe?.trim()      ? `\n- Vibe / mood: ${vibe.trim()}`              : ''
  const refLine     = refArtist?.trim() ? `\n- Reference artists: ${refArtist.trim()}`   : ''
  const lockedBlock = buildLockedSection(lockedTracks || [])

  const curveStr = energyCurve.map((e, i) => `Track ${i + 1}: energy ${e}/10`).join(', ')

  const contextBlock = prevTracks?.length
    ? `\nThis chunk continues from: ${prevTracks.map(t => `"${t.artist} — ${t.title}" [${t.bpm} BPM, ${t.key}]`).join(' → ')}. First track MUST flow naturally from these.\n`
    : ''

  const positionNote = {
    full:    '',
    opening: '\nThis is the OPENING section — start low energy, build gradually.',
    closing: '\nThis is the CLOSING section — follow the energy curve to the end.',
  }[position]

  const prompt = `You are a world-class DJ set curator. Build a ${position === 'full' ? 'complete' : position} DJ set section.

Parameters:
- Genre: ${genre}
- Crowd: ${crowd}${vibeLine}${refLine}
- BPM range: ${bpmLow}–${bpmHigh}
- Harmonic key matching: ${keyMatch ? 'YES — adjacent Camelot keys must be compatible (same number, ±1, or A↔B)' : 'not required'}
- Track count: ${targetCount} tracks
- Energy: start ${energyStart}/10 → end ${energyEnd}/10
- Custom energy per position: ${curveStr}${positionNote}${contextBlock}${lockedBlock}

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "title": ${setTitle ? `"${setTitle}"` : '"evocative set name (3–5 words)"'},
  "summary": "1 sentence describing the energy journey",
  "tracks": [
    { "n": 1, "artist": "Artist", "title": "Title", "bpm": 124, "key": "8A", "energy": 4, "transition": "mix note into next track" }
  ]
}

Rules:
- Pick REAL, WELL-KNOWN tracks that fit the genre and BPM range
- Match each track's energy to the per-position value above
- ${keyMatch ? 'Adjacent keys must be harmonically compatible' : 'Key matching off — focus on BPM and energy'}
- Transition notes should be specific (e.g. "filter sweep on the breakdown, swap kicks at the drop")
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
      genre, crowd, arc, vibe, refArtist,
      mode, minutes, count,
      bpmLow = 120, bpmHigh = 128,
      keyMatch = true,
      lockedTracks = [],
      energyPoints,
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

    // Energy curve
    const defaultCurve = arc === 'Peak Time Energy'  ? [8,9,10,9,8]
                       : arc === 'Cool Down'          ? [8,7,5,4,3]
                       : arc === 'Wave (up & down)'   ? [5,8,5,9,6]
                       :                               [3,5,6,8,9]  // Slow Build default
    const energyCurve = interpolateEnergy(
      energyPoints?.length === 5 ? energyPoints : defaultCurve,
      targetTracks,
    )

    const baseParams = { genre, crowd, vibe: vibe||'', refArtist: refArtist||'', bpmLow, bpmHigh, keyMatch }

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
      })

      // Chunk 2: closing, seeded from chunk 1's last 2 tracks
      const prevTracks = ((chunk1.tracks || []) as { artist:string; title:string; bpm:number; key:string }[]).slice(-2)
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

    recordUsage(userId, 'generate')

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
    console.error('[POST /api/generate]', err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}