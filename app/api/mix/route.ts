import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'
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

    const { track1, track2 } = await req.json()
    if (!track1 || !track2) return NextResponse.json({ error: 'Two tracks required.' }, { status: 400 })

    // Record usage now, before the Anthropic call — see generate/route.ts
    // for why (check-then-record isn't atomic; recording early shrinks the
    // parallel-request exploit window from "the whole call" to one DB write).
    await recordUsage(userId, 'generate')

    const bpmDelta = Math.round(((track2.bpm || 0) - (track1.bpm || 0)) * 10) / 10

    const prompt = `You are an expert DJ educator giving precise, practical mixing advice.

OUTGOING TRACK (Track 1):
- Artist/Title: ${track1.artist || 'Unknown'} — ${track1.title || 'Unknown'}
- BPM: ${track1.bpm || '?'}
- Camelot Key: ${track1.key || '?'}
- Energy: ${track1.energy || '?'}/10

INCOMING TRACK (Track 2):
- Artist/Title: ${track2.artist || 'Unknown'} — ${track2.title || 'Unknown'}
- BPM: ${track2.bpm || '?'}
- Camelot Key: ${track2.key || '?'}
- Energy: ${track2.energy || '?'}/10

BPM difference: ${bpmDelta > 0 ? '+' : ''}${bpmDelta} BPM

Give specific, actionable DJ advice for mixing Track 1 into Track 2.

Return ONLY valid JSON, no markdown:
{
  "technique": "The main mixing technique to use — 2-3 sentences, specific to these tracks and BPM/key difference",
  "eqTips": "Specific EQ and filter settings — which frequencies to cut/boost on which deck and when in the mix — 2-3 sentences",
  "timing": "Exact timing and cue point advice — where to drop the incoming track, how many bars to blend, when to cut — 2-3 sentences",
  "warning": "One specific thing that could go wrong and how to prevent it. Set to null if no significant risk."
}`

    const msg = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw  = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json(data)
  } catch (err) {
    logError('[POST /api/mix]', err)
    return NextResponse.json({ error: 'Failed to get mixing advice.' }, { status: 500 })
  }
}
