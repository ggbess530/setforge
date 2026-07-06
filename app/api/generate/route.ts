// ▸ Replace: app/api/generate/route.ts

import { auth }         from '@clerk/nextjs/server'

// Extend Vercel timeout to 120s for large chunked sets
export const maxDuration = 120
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'
import { enrichTracks, type EnrichableTrack } from '@/lib/track-enrichment'

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
  energyCurve:  number[]
  position:          'full' | 'opening' | 'closing'
  includeMixingNotes?: boolean
  lockedTracks?: { n:number; artist:string; title:string; bpm:number; key:string; energy:number }[]
  prevTracks?:  { artist:string; title:string; bpm:number; key:string }[]
  setTitle?:    string
  recentTracks?: string[]
  libraryTracks?: { artist:string; title:string; bpm?:number; key?:string }[]
}): Promise<{ title: string; summary: string; tracks: unknown[] }> {

  const {
    genre, crowd, vibe, refArtist,
    bpmLow, bpmHigh, keyMatch,
    targetCount, energyStart, energyEnd, energyCurve,
    position, includeMixingNotes = true, lockedTracks, prevTracks, setTitle, recentTracks = [],
    libraryTracks = [],
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
- BPM range: ${bpmLow}–${bpmHigh}
- Harmonic key matching: ${keyMatch ? 'YES — adjacent Camelot keys must be compatible (same number, ±1, or A↔B)' : 'not required'}
- Track count: ${targetCount} tracks
- Energy: start ${energyStart}/10 → end ${energyEnd}/10
- Custom energy per position: ${curveStr}${positionNote}${contextBlock}${lockedBlock}${avoidBlock}${libraryBlock}

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
        includeMixingNotes,
        recentTracks,
        libraryTracks,
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

    try {
      await enrichTracks(finalSet.tracks as EnrichableTrack[])
    } catch (err) {
      console.warn('[generate] metadata enrichment failed, keeping AI-guessed values', err)
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
    console.error('[POST /api/generate]', err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
