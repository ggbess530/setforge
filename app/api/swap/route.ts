import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription } from '@/lib/subscription'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (!sub.active) return NextResponse.json({ error: 'No active subscription.' }, { status: 403 })

    const {
      target, prev, next, existing,
      genre, crowd, arc, vibe, refArtist, bpmLow, bpmHigh, keyMatch,
    } = await req.json()

    if (!target) return NextResponse.json({ error: 'Missing target track' }, { status: 400 })

    const existingList = (existing ?? [])
      .map((t: { artist: string; title: string }) => `"${t.artist} — ${t.title}"`)
      .join(', ')

    const prompt = `You are a world-class DJ. Suggest FOUR replacement tracks for a single slot in an existing set.

Set context:
- Genre: ${genre} | Crowd: ${crowd} | Arc: ${arc}${vibe ? ` | Vibe: ${vibe}` : ''}${refArtist ? ` | Ref: ${refArtist}` : ''}
- BPM range: ${bpmLow}–${bpmHigh} | Harmonic key matching: ${keyMatch ? 'yes' : 'no'}

Replace track ${target.n}: "${target.artist} — ${target.title}" (${target.bpm} BPM, ${target.key}, energy ${target.energy}/10)
${prev ? `Previous track: "${prev.artist} — ${prev.title}" (${prev.bpm} BPM, ${prev.key})` : 'This is the first track.'}
${next ? `Next track:     "${next.artist} — ${next.title}" (${next.bpm} BPM, ${next.key})` : 'This is the last track.'}

DO NOT suggest any of these (already in the set): ${existingList}

Return exactly 4 suggestions with these distinct roles:
1. "Best match"    — closest BPM, harmonically compatible key (same or ±1 Camelot), same energy. The safest swap.
2. "Key shift"     — adjacent Camelot key for intentional key movement, similar BPM and energy.
3. "Energy shift"  — same genre/BPM area but noticeably higher or lower energy to reshape the arc.
4. "Wildcard"      — same genre and BPM ballpark but surprising/unexpected. Can be less harmonic. Bold choice.

Respond ONLY with valid JSON, no markdown:
{
  "suggestions": [
    { "n": ${target.n}, "label": "Best match",   "artist": "...", "title": "...", "bpm": 0, "key": "8A", "energy": ${target.energy}, "transition": "short mix note into next track" },
    { "n": ${target.n}, "label": "Key shift",    "artist": "...", "title": "...", "bpm": 0, "key": "9A", "energy": ${target.energy}, "transition": "..." },
    { "n": ${target.n}, "label": "Energy shift", "artist": "...", "title": "...", "bpm": 0, "key": "8A", "energy": ${Math.min(10, target.energy + 2)}, "transition": "..." },
    { "n": ${target.n}, "label": "Wildcard",     "artist": "...", "title": "...", "bpm": 0, "key": "3B", "energy": 0, "transition": "..." }
  ]
}

Rules:
- All tracks MUST be real, commercially released tracks on Beatport or Spotify — no bootlegs, no guesses
- BPM values must be integers within ${bpmLow}–${bpmHigh}
- All 4 suggestions must be different tracks from each other and from the original`

    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 1200,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw  = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json({ suggestions: data.suggestions })

  } catch (err: unknown) {
    console.error('[POST /api/swap]', err)
    if (err instanceof SyntaxError) return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    return NextResponse.json({ error: 'Swap failed. Please try again.' }, { status: 500 })
  }
}
