import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ bpm: null, key: null }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (!sub.active) return NextResponse.json({ bpm: null, key: null }, { status: 403 })
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({ bpm: null, key: null }, { status: 429 })
    }

    const { artist, title } = await req.json()
    if (!artist || !title) return NextResponse.json({ bpm: null, key: null })

    // Record usage now, before the Anthropic call — see generate/route.ts
    // for why (check-then-record isn't atomic; recording early shrinks the
    // parallel-request exploit window from "the whole call" to one DB write).
    await recordUsage(userId, 'generate')

    const msg = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 80,
      messages:   [{
        role:    'user',
        content: `What is the BPM and Camelot key for this DJ track?
Artist: "${artist}"
Title: "${title}"

Respond with valid JSON only, no markdown:
{"bpm": 128, "key": "8A"}

Rules:
- bpm must be an integer or null if uncertain
- key must be Camelot notation (e.g. "8A", "3B") or null if uncertain
- Only return values you are confident about for this specific track`,
      }],
    })

    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
    const data = JSON.parse(text)

    return NextResponse.json({
      bpm: typeof data.bpm === 'number' ? Math.round(data.bpm) : null,
      key: typeof data.key === 'string' && /^\d+[AB]$/i.test(data.key) ? data.key.toUpperCase() : null,
    })
  } catch {
    return NextResponse.json({ bpm: null, key: null })
  }
}
