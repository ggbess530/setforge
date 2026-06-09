// ▸ Place at: app/api/generate/route.ts

import { auth }          from '@clerk/nextjs/server'
import { NextResponse }  from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'

export async function POST(req: Request) {
  try {
    // ── 1. Authentication ─────────────────────────────────────
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Subscription gate ──────────────────────────────────
    const sub = await checkSubscription(userId)

    if (!sub.active) {
      return NextResponse.json(
        { error: 'No active subscription. Subscribe to start forging sets.' },
        { status: 403 }
      )
    }

    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json(
        {
          error: `Monthly limit reached on your ${sub.tier} plan. Upgrade to Pro for unlimited sets.`,
          code:  'LIMIT_REACHED',
        },
        { status: 429 }
      )
    }

    // ── 3. Parse + validate request body ─────────────────────
    const body = await req.json()
    const {
      genre,
      crowd,
      arc,
      vibe,
      refArtist,
      mode,
      minutes,
      count,
      bpmLow,
      bpmHigh,
      keyMatch,
    } = body

    // Basic guard — prevents empty/malformed calls burning tokens
    if (!genre || !crowd || !arc) {
      return NextResponse.json(
        { error: 'Missing required fields: genre, crowd, arc' },
        { status: 400 }
      )
    }

    // ── 4. Build prompt ───────────────────────────────────────
    const lengthSpec = mode === 'time' ? `${minutes} minutes total` : `${count} tracks total`
    const vibeLine   = vibe?.trim()
      ? `\n- Vibe / mood: ${vibe.trim()}`
      : ''
    const refLine    = refArtist?.trim()
      ? `\n- Reference artists / style anchor: ${refArtist.trim()} (curate tracks that would fit alongside these artists)`
      : ''

    const prompt = `You are a world-class DJ and set curator. Build a professional DJ set blueprint.

Parameters:
- Genre: ${genre}
- Crowd / context: ${crowd}
- Energy arc: ${arc}${vibeLine}${refLine}
- Length: ${lengthSpec}
- BPM range: ${bpmLow}–${bpmHigh}
- Harmonic (Camelot) key matching: ${keyMatch ? 'YES — order tracks so adjacent keys are compatible' : 'not required'}

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
- Pick real, well-known tracks that fit the genre. These are suggestions the DJ will verify in their library.
- Number of tracks should fit the requested length (~4–5 min per track if length is in minutes).`

    // ── 5. Call Anthropic ─────────────────────────────────────
    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    const set = JSON.parse(raw.replace(/```json|```/g, '').trim())

    // ── 6. Record usage (fire-and-forget) ─────────────────────
    recordUsage(userId, 'generate')

    // ── 7. Return set + remaining quota info ──────────────────
    return NextResponse.json({
      set,
      quota: {
        tier:      sub.tier,
        remaining: sub.remainingGenerations === null
          ? 'unlimited'
          : sub.remainingGenerations - 1,  // minus this generation
      },
    })

  } catch (err: unknown) {
    console.error('[POST /api/generate]', err)

    // Surface JSON parse failures clearly — they usually mean Claude returned
    // something unexpected and the prompt needs tightening
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'AI returned malformed data. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: 'Generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
