// ▸ Create folder: app/api/why/
// ▸ Place at:      app/api/why/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'

// ── POST /api/why ─────────────────────────────────────────────
// Returns plain-English reasoning for a specific track choice
// Body: { track, prevTrack, nextTrack, genre, crowd, arc, position }
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (!sub.active) return NextResponse.json({ error: 'No active subscription.' }, { status: 403 })
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({ error: 'Generation limit reached.', code: 'LIMIT_REACHED' }, { status: 429 })
    }

    const { track, prevTrack, nextTrack, genre, crowd, arc, setLength } = await req.json()

    if (!track) return NextResponse.json({ error: 'No track provided.' }, { status: 400 })

    // ── Key compatibility analysis ──────────────────────────────
    function keysCompatible(k1?: string, k2?: string): string {
      if (!k1 || !k2) return 'unknown'
      const m1 = k1.match(/^(\d+)([AB])$/), m2 = k2.match(/^(\d+)([AB])$/)
      if (!m1 || !m2) return 'unknown'
      const n1 = parseInt(m1[1]), n2 = parseInt(m2[1])
      const t1 = m1[2], t2 = m2[2]
      if (n1 === n2 && t1 === t2) return 'perfect_match'
      if (n1 === n2 && t1 !== t2) return 'relative_switch'
      if (Math.abs(n1 - n2) === 1 || Math.abs(n1 - n2) === 11) return 'adjacent'
      return 'incompatible'
    }

    const inboundKey  = keysCompatible(prevTrack?.key, track.key)
    const outboundKey = keysCompatible(track.key, nextTrack?.key)

    const prompt = `You are an expert DJ educator explaining set curation decisions in plain English.

A DJ set is being built with these parameters:
- Genre: ${genre || 'not specified'}
- Crowd: ${crowd || 'not specified'}
- Energy arc: ${arc || 'not specified'}
- Set length: ~${setLength || '?'} tracks

The track being explained:
- Artist: ${track.artist}
- Title: ${track.title}
- BPM: ${track.bpm || 'unknown'}
- Camelot key: ${track.key || 'unknown'}
- Energy level: ${track.energy || 'unknown'}/10
- Position in set: track ${track.n}

${prevTrack ? `Previous track: "${prevTrack.artist} — ${prevTrack.title}" [${prevTrack.bpm || '?'} BPM, ${prevTrack.key || '?'}]
Key relationship (inbound): ${inboundKey}` : 'This is the opening track.'}

${nextTrack ? `Next track: "${nextTrack.artist} — ${nextTrack.title}" [${nextTrack.bpm || '?'} BPM, ${nextTrack.key || '?'}]
Key relationship (outbound): ${outboundKey}` : 'This is the closing track.'}

Write a SHORT, friendly explanation (3-5 sentences max) covering:
1. Why THIS track fits this genre/crowd/energy position
2. How it flows from the previous track (BPM change, key compatibility, energy shift)
3. One specific mixing tip for the transition IN to this track
4. One thing to watch out for or a creative opportunity

Use plain English — no jargon without explanation. Be specific to THIS track, not generic advice.
Write as if you're a knowledgeable DJ friend explaining your choices over a coffee.

Respond with JSON only:
{
  "why": "main explanation of why this track was chosen",
  "inbound": "how to mix from the previous track into this one",
  "outbound": "how to set up the mix out of this track into the next",
  "tip": "one specific creative tip or thing to watch out for",
  "keyNote": "plain-English explanation of the key relationship"
}`

    const msg = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw  = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim())

    await recordUsage(userId, 'generate')
    return NextResponse.json(data)

  } catch (err) {
    console.error('[POST /api/why]', err)
    return NextResponse.json({ error: 'Failed to explain track choice.' }, { status: 500 })
  }
}
