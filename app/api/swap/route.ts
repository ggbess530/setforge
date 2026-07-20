import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'
import { enrichTracks, type EnrichableTrack } from '@/lib/track-enrichment'
import { logError } from '@/lib/log-error'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (!sub.active) return NextResponse.json({ error: 'No active subscription.' }, { status: 403 })
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({ error: 'Generation limit reached.', code: 'LIMIT_REACHED' }, { status: 429 })
    }

    const {
      target, prev, next, existing,
      genre, crowd, familiarity, vibe, refArtist, bpmLow, bpmHigh, keyMatch,
    } = await req.json()

    if (!target) return NextResponse.json({ error: 'Missing target track' }, { status: 400 })

    // Record usage now, before the Anthropic call — see generate/route.ts
    // for why (check-then-record isn't atomic; recording early shrinks the
    // parallel-request exploit window from "the whole call" to one DB write).
    await recordUsage(userId, 'generate')

    const existingList = (existing ?? [])
      .map((t: { artist: string; title: string }) => `"${t.artist} — ${t.title}"`)
      .join(', ')

    const prompt = `You are a world-class DJ. Suggest FOUR replacement tracks for a single slot in an existing set.

Set context:
- Genre: ${genre} | Crowd: ${crowd} | Track familiarity: ${familiarity || 'Balanced Mix'}${vibe ? ` | Vibe: ${vibe}` : ''}${refArtist ? ` | Ref: ${refArtist}` : ''}
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
- All 4 suggestions must be different tracks from each other and from the original
${keyMatch ? `- Strict Camelot key rules: compatible keys for ${target.key} are same number (${target.key.replace(/[AB]/,'A')} and ${target.key.replace(/[AB]/,'B')}), and ±1 same letter with 12↔1 wrap. No other keys are harmonic.` : ''}`

    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 1200,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw  = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim())

    try {
      await enrichTracks(data.suggestions as EnrichableTrack[])
    } catch (err) {
      console.warn('[swap] metadata enrichment failed, keeping AI-guessed values', err)
    }

    return NextResponse.json({ suggestions: data.suggestions })

  } catch (err: unknown) {
    logError('[POST /api/swap]', err)
    if (err instanceof SyntaxError) return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    return NextResponse.json({ error: 'Swap failed. Please try again.' }, { status: 500 })
  }
}
