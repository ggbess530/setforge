// ▸ Create folder: app/api/banger/
// ▸ Place at:      app/api/banger/route.ts
//
// ── POST /api/banger ─────────────────────────────────────────
// Live-view "read the room" button: instantly picks ONE real, high-energy,
// crowd-hype track to drop in right after whatever's currently playing,
// plus a mix note for bringing it in. Same cost profile as a swap (it's
// picking a brand-new track), so it's metered the same way.
// Body: { current, existing, genre, crowd }

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
    if (sub.tier === 'free') {
      return NextResponse.json({ error: 'The Banger button is a Pro feature.', code: 'PRO_REQUIRED' }, { status: 403 })
    }
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({ error: 'Generation limit reached.', code: 'LIMIT_REACHED' }, { status: 429 })
    }

    const { current, existing, genre, crowd } = await req.json()
    if (!current?.artist || !current?.title) {
      return NextResponse.json({ error: 'Missing current track.' }, { status: 400 })
    }

    // Record usage now, before the Anthropic call — see generate/route.ts
    // for why (check-then-record isn't atomic; recording early shrinks the
    // parallel-request exploit window from "the whole call" to one DB write).
    await recordUsage(userId, 'generate')

    const existingList = (existing ?? [])
      .map((t: { artist: string; title: string }) => `"${t.artist} — ${t.title}"`)
      .join(', ')

    const prompt = `You are a world-class DJ reading a live crowd that needs an immediate energy spike. Pick ONE real, high-impact "banger" track to drop in right after the track currently playing — maximum crowd hype potential: a huge drop, an instantly recognizable hook, or a moment built for hands in the air.

Currently playing: "${current.artist} — ${current.title}"${current.bpm ? ` (${current.bpm} BPM)` : ''}${current.key ? ` (${current.key})` : ''}
${genre ? `Genre: ${genre}` : ''}${crowd ? ` | Crowd: ${crowd}` : ''}

DO NOT suggest any of these (already in the set): ${existingList || 'none'}

Requirements:
- A real, commercially released, widely-recognized track — this is a crowd-hype moment, not a deep cut
- Energy 9 or 10 out of 10
- BPM within about 6 of the current track so it's still mixable live, unless a deliberate bigger jump clearly serves the hype moment better
- Write ONE short, energetic mix note (DJ terminology) for how to bring it in for maximum impact

Respond ONLY with valid JSON, no markdown:
{ "artist": "...", "title": "...", "bpm": 0, "key": "8A", "energy": 10, "transition": "short, high-impact mix note" }`

    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 300,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw   = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const track = JSON.parse(raw.replace(/```json|```/g, '').trim())

    try {
      await enrichTracks([track] as EnrichableTrack[])
    } catch (err) {
      console.warn('[banger] metadata enrichment failed, keeping AI-guessed values', err)
    }

    return NextResponse.json({ track })

  } catch (err: unknown) {
    logError('[POST /api/banger]', err)
    if (err instanceof SyntaxError) return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    return NextResponse.json({ error: 'Failed to find a banger. Please try again.' }, { status: 500 })
  }
}
