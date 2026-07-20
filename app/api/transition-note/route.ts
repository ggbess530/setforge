// ▸ Create folder: app/api/transition-note/
// ▸ Place at:      app/api/transition-note/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'
import { logError } from '@/lib/log-error'

// ── POST /api/transition-note ───────────────────────────────────
// Writes a single mix note for one already-chosen track given its
// neighbors — used when a track is manually dropped into a loaded set
// (e.g. from Liked Songs) and so never went through the normal
// generation prompt that writes transitions for every track up front.
// Body: { track, prevTrack, nextTrack, genre, crowd }
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (!sub.active) return NextResponse.json({ error: 'No active subscription.' }, { status: 403 })
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({ error: 'Generation limit reached.', code: 'LIMIT_REACHED' }, { status: 429 })
    }

    const { track, prevTrack, nextTrack, genre, crowd } = await req.json()
    if (!track?.artist || !track?.title) {
      return NextResponse.json({ error: 'No track provided.' }, { status: 400 })
    }

    // Record usage now, before the Anthropic call — see generate/route.ts
    // for why (check-then-record isn't atomic; recording early shrinks the
    // parallel-request exploit window from "the whole call" to one DB write).
    await recordUsage(userId, 'generate')

    const prompt = `You are a world-class DJ. Write ONE short transition note (a single sentence, real DJ terminology) describing how to mix the following track into its position in a set.

Track: "${track.artist} — ${track.title}"${track.bpm ? ` (${track.bpm} BPM)` : ''}${track.key ? ` (${track.key})` : ''}${track.energy ? `, energy ${track.energy}/10` : ''}
${prevTrack ? `Coming from: "${prevTrack.artist} — ${prevTrack.title}"${prevTrack.bpm ? ` (${prevTrack.bpm} BPM)` : ''}${prevTrack.key ? ` (${prevTrack.key})` : ''}` : 'This is the first track in the set.'}
${nextTrack ? `Going into: "${nextTrack.artist} — ${nextTrack.title}"${nextTrack.bpm ? ` (${nextTrack.bpm} BPM)` : ''}${nextTrack.key ? ` (${nextTrack.key})` : ''}` : 'This is the last track in the set.'}
${genre ? `Genre: ${genre}` : ''}${crowd ? ` | Crowd: ${crowd}` : ''}

Respond ONLY with valid JSON, no markdown:
{ "transition": "short, specific mix note describing how to blend this track in and out" }`

    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 150,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw  = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json({ transition: data.transition || '' })

  } catch (err: unknown) {
    logError('[POST /api/transition-note]', err)
    if (err instanceof SyntaxError) return NextResponse.json({ error: 'AI returned malformed data.' }, { status: 502 })
    return NextResponse.json({ error: 'Failed to generate mix note.' }, { status: 500 })
  }
}
