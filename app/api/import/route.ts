// ▸ Create folder: app/api/import/
// ▸ Place at:      app/api/import/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { checkSubscription, recordUsage } from '@/lib/subscription'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json(
        {
          error: sub.isFree
            ? "You've used all 5 free sets this month. Upgrade to Pro for unlimited sets."
            : 'Monthly limit reached. Upgrade for unlimited sets.',
          code: 'LIMIT_REACHED', isFree: sub.isFree,
        },
        { status: 429 }
      )
    }

    const { tracks, bpmLow = 100, bpmHigh = 140, keyMatch = true } = await req.json()

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided.' }, { status: 400 })
    }
    if (tracks.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 tracks per import.' }, { status: 400 })
    }

    // Build track list for the prompt
    const trackList = tracks
      .map((t: { artist:string; title:string; bpm?:number; key?:string }, i: number) => {
        let line = `${i + 1}. "${t.artist} - ${t.title}"`
        if (t.bpm) line += ` [${t.bpm} BPM]`
        if (t.key) line += ` [Key: ${t.key}]`
        return line
      })
      .join('\n')

    const prompt = `You are a world-class DJ. The user has imported these ${tracks.length} tracks from their DJ software library:

${trackList}

Create an optimally ordered DJ set using EXACTLY AND ONLY these tracks — do not add, remove, or replace any of them.

Your job is to:
1. Find the best order for these tracks based on BPM flow, harmonic key compatibility, and energy progression
2. Create a natural energy arc (slow build or waves work well for most sets)
3. Write a transition note for each track explaining how to mix into the next one
4. Estimate BPM and Camelot key for any tracks missing that data — use your knowledge of these artists/tracks
${keyMatch ? '5. Prioritize harmonic key compatibility — adjacent tracks should have compatible Camelot keys' : ''}

BPM preference: keep progression within ${bpmLow}–${bpmHigh} BPM where possible.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "title": "short evocative set name based on the music",
  "summary": "1 sentence describing the vibe and journey of this set",
  "tracks": [
    { "n": 1, "artist": "Artist Name", "title": "Track Title", "bpm": 124, "key": "8A", "energy": 6, "transition": "transition note into the next track" }
  ]
}

IMPORTANT: Every track from the imported list must appear exactly once in your output. Use the exact artist and title names provided.`

    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const set = JSON.parse(raw.replace(/```json|```/g, '').trim())

    recordUsage(userId, 'generate')

    return NextResponse.json({
      set,
      quota: {
        tier:      sub.tier,
        remaining: sub.remainingGenerations === null ? 'unlimited' : sub.remainingGenerations - 1,
        trial:     sub.trial ?? null,
        isFree:    sub.isFree ?? false,
      },
    })

  } catch (err: unknown) {
    console.error('[POST /api/import]', err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Import failed. Please try again.' }, { status: 500 })
  }
}