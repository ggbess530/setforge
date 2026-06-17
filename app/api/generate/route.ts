// ▸ Place at: app/api/generate/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)

    // Free tier limit reached
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json(
        {
          error: sub.isFree
            ? 'You\'ve used all 5 free sets this month. Upgrade to Pro for unlimited sets.'
            : `Monthly limit reached on your ${sub.tier} plan. Upgrade to Pro for unlimited sets.`,
          code: 'LIMIT_REACHED',
          isFree: sub.isFree,
        },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { genre, crowd, arc, vibe, refArtist, mode, minutes, count, bpmLow, bpmHigh, keyMatch, lockedTracks } = body

    if (!genre || !crowd || !arc) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    if (typeof genre !== 'string' || genre.length > 120) {
      return NextResponse.json({ error: 'Genre must be under 120 characters.' }, { status: 400 })
    }

    const lengthSpec = mode === 'time' ? `${minutes} minutes total` : `${count} tracks total`
    const vibeLine   = vibe?.trim()      ? `\n- Vibe / mood: ${vibe.trim()}` : ''
    const refLine    = refArtist?.trim() ? `\n- Reference artists / style anchor: ${refArtist.trim()} (curate tracks that would fit alongside these artists)` : ''

    let lockedSection = ''
    if (Array.isArray(lockedTracks) && lockedTracks.length > 0) {
      const lockedList = lockedTracks
        .map((t: { n:number; artist:string; title:string; bpm:number; key:string; energy:number }) =>
          `  Position ${t.n}: "${t.artist} - ${t.title}" (${t.bpm} BPM, ${t.key}, energy ${t.energy}) — KEEP EXACTLY AS IS`)
        .join('\n')
      lockedSection = `\n\nLOCKED TRACKS (keep at their exact positions, unchanged):\n${lockedList}\n\nBuild the rest of the set around these locked tracks.`
    }

    const prompt = `You are a world-class DJ and set curator. Build a professional DJ set blueprint.

Parameters:
- Genre: ${genre}
- Crowd / context: ${crowd}
- Energy arc: ${arc}${vibeLine}${refLine}
- Length: ${lengthSpec}
- BPM range: ${bpmLow}–${bpmHigh}
- Harmonic (Camelot) key matching: ${keyMatch ? 'YES — order tracks so adjacent keys are compatible' : 'not required'}${lockedSection}

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "title": "short evocative set name",
  "summary": "1 sentence describing the journey",
  "tracks": [
    { "n": 1, "artist": "Artist Name", "title": "Track Title", "bpm": 124, "key": "8A", "energy": 4, "transition": "short cue/mix note into the next track" }
  ]
}

Rules:
- energy is 1–10. Shape the energy curve to match the "${arc}" arc.
- Keep BPMs within or progressing naturally through the range.
- If key matching is on, adjacent Camelot keys must be compatible (same number, ±1, or same number A↔B).
- Pick real, well-known tracks that fit the genre.
- Number of tracks should fit the requested length (~4–5 min per track if length is in minutes).
- If locked tracks are specified, reproduce them EXACTLY at their stated positions.`

    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const set = JSON.parse(raw.replace(/```json|```/g, '').trim())

    recordUsage(userId, 'generate')

    return NextResponse.json({
      set,
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