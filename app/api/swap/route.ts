// ▸ Place at: app/api/swap/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription } from '@/lib/subscription'

export async function POST(req: Request) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Subscription check (swaps are included on all paid tiers) ──
    const sub = await checkSubscription(userId)
    if (!sub.active) {
      return NextResponse.json(
        { error: 'No active subscription.' },
        { status: 403 }
      )
    }

    // ── 3. Parse body ─────────────────────────────────────────
    const {
      target,    // { n, artist, title, bpm, key, energy }
      prev,      // track before target (or null)
      next,      // track after target (or null)
      existing,  // array of { artist, title } — all current tracks
      genre, crowd, arc, vibe, refArtist, bpmLow, bpmHigh, keyMatch,
    } = await req.json()

    if (!target) {
      return NextResponse.json({ error: 'Missing target track' }, { status: 400 })
    }

    const existingList = (existing ?? [])
      .map((t: { artist: string; title: string }) => `${t.artist} - ${t.title}`)
      .join('; ')

    // ── 4. Build prompt ───────────────────────────────────────
    const prompt = `You are a world-class DJ. Replace ONE track in an existing set with a better alternative.

Set context:
- Genre: ${genre} | Crowd: ${crowd} | Arc: ${arc}${vibe ? ` | Vibe: ${vibe}` : ''}${refArtist ? ` | Ref: ${refArtist}` : ''}
- BPM range: ${bpmLow}–${bpmHigh} | Harmonic key matching: ${keyMatch ? 'yes' : 'no'}

Replace track ${target.n}: "${target.artist} - ${target.title}" (${target.bpm} BPM, ${target.key}, energy ${target.energy}).
${prev ? `Comes after: "${prev.artist} - ${prev.title}" (${prev.bpm} BPM, ${prev.key}).` : 'This is the first track.'}
${next ? `Comes before: "${next.artist} - ${next.title}" (${next.bpm} BPM, ${next.key}).` : 'This is the last track.'}

Do NOT repeat any of these tracks: ${existingList}

Pick a DIFFERENT real track that:
- Has similar energy (${target.energy}/10)
- Has a BPM that bridges its neighbours naturally
${keyMatch ? `- Has a Camelot key compatible with both neighbours (same number, ±1, or same number A↔B)` : ''}

Respond ONLY with valid JSON:
{ "n": ${target.n}, "artist": "...", "title": "...", "bpm": 0, "key": "8A", "energy": ${target.energy}, "transition": "short cue/mix note into the next track" }`

    // ── 5. Call Anthropic ─────────────────────────────────────
    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 512,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw  = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const track = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json({ track })

  } catch (err: unknown) {
    console.error('[POST /api/swap]', err)

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'AI returned malformed data. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: 'Swap failed. Please try again.' },
      { status: 500 }
    )
  }
}
