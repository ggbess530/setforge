// ▸ Create folder: app/api/mix/
// ▸ Place at:      app/api/mix/route.ts

import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'

export async function POST(req: Request) {
  try {
    const { track1, track2 } = await req.json()

    if (!track1?.bpm || !track2?.bpm || !track1?.key || !track2?.key) {
      return NextResponse.json({ error: 'BPM and key required for both tracks.' }, { status: 400 })
    }

    const prompt = `You are an expert DJ technician giving specific, practical mixing advice.

Track 1 (OUTGOING): "${track1.artist} — ${track1.title}" [${track1.bpm} BPM, ${track1.key}, energy ${track1.energy}/10]
Track 2 (INCOMING): "${track2.artist} — ${track2.title}" [${track2.bpm} BPM, ${track2.key}, energy ${track2.energy}/10]

Give specific, practical advice for mixing these two tracks. Respond ONLY with valid JSON:
{
  "technique": "2-3 sentences: exact technique for this specific mix — when to start the mix, what to do with the crossfader, which musical elements to use as cue points",
  "eqTips": "2-3 sentences: specific EQ and FX advice — which frequencies to cut/boost, whether to use filters, reverb, or other effects during the transition",
  "timing": "2-3 sentences: timing cues — count in bars, use the break/drop/intro, specific moments in these tracks to make the move",
  "warning": "1 sentence about the biggest risk with this specific mix and how to avoid it, OR null if the mix is straightforward"
}

Be specific to THESE tracks if you know them. Use actual bar counts, specific frequency ranges (e.g. 'cut the 200Hz on the outgoing'), and reference track structure (intro, breakdown, drop) where relevant.`

    const msg = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw  = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json(data)

  } catch (err) {
    console.error('[POST /api/mix]', err)
    return NextResponse.json({ error: 'Failed to get mixing advice.' }, { status: 500 })
  }
}
