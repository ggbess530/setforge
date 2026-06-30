// ▸ Create: app/api/planner/generate/route.ts
// Generates a set for one slot with full night context awareness

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({ error: 'Generation limit reached.', code: 'LIMIT_REACHED' }, { status: 429 })
    }

    const { slot, prevSlot, nextSlot, includeMixingNotes = true } = await req.json()

    const prevContext = prevSlot
      ? `\nPREVIOUS SET (${prevSlot.djName || 'Previous DJ'}): ${prevSlot.genre}, ${prevSlot.duration} min, ended at energy ${prevSlot.targetEnergy}/10. The first track of your set MUST flow naturally from this.`
      : '\nThis is the OPENING set of the night — start appropriately low energy.'

    const nextContext = nextSlot
      ? `\nNEXT SET (${nextSlot.djName || 'Next DJ'}): ${nextSlot.genre}, target energy ${nextSlot.targetEnergy}/10. Shape your closing tracks to hand off smoothly to them.`
      : '\nThis is the CLOSING set — bring the night to a satisfying end.'

    const trackCount = Math.round((slot.duration || 60) / 4.5)

    const prompt = `You are a world-class DJ set curator planning a full night event.

YOUR SLOT:
- DJ: ${slot.djName || 'DJ'}
- Genre: ${slot.genre}
- Duration: ${slot.duration} minutes (~${trackCount} tracks)
- Start time: ${slot.startTime}
- Target energy: ${slot.targetEnergy}/10
- Crowd: ${slot.crowd || 'Club'}
- Vibe: ${slot.vibe || ''}
- BPM range: ${slot.bpmLow || 120}–${slot.bpmHigh || 128}
${prevContext}
${nextContext}

Build a set that fits perfectly into this night's flow. The first track must work as a handoff from the previous DJ and the last track must set up the next DJ.

Respond ONLY with valid JSON:
{
  "title": "set name",
  "summary": "1 sentence about this set's role in the night",
  "tracks": [
    { "n": 1, "artist": "Artist", "title": "Title", "bpm": 124, "key": "8A", "energy": 5${includeMixingNotes ? ', "transition": "mix note"' : ''} }
  ],
  "handoffNote": "1 sentence on how the opening track connects from the previous set",
  "closingNote": "1 sentence on how the closing track sets up the next DJ"
}`

    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL, max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const set = JSON.parse(raw.replace(/```json|```/g, '').trim())

    recordUsage(userId, 'generate')
    return NextResponse.json({ set, quota: { tier: sub.tier, remaining: sub.remainingGenerations === null ? 'unlimited' : sub.remainingGenerations - 1 } })

  } catch (err) {
    console.error('[POST /api/planner/generate]', err)
    return NextResponse.json({ error: 'Generation failed.' }, { status: 500 })
  }
}
