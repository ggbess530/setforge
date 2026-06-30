// ▸ Place at: app/api/mashup/route.ts

import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'

export async function POST(req: Request) {
  try {
    const { artist, title, bpm, key, genres } = await req.json()
    if (!artist && !title) return NextResponse.json({ error: 'Track info required.' }, { status: 400 })

    const prompt = `You are an expert DJ and music producer specialising in mashups and creative track combinations.

SOURCE TRACK: "${artist} — ${title}"${bpm ? ` [${bpm} BPM]` : ''}${key ? ` [${key} Camelot key]` : ''}
${genres?.length ? `Avoid these genres (same as source): ${genres.join(', ')}` : ''}

Find 6 real tracks from DIFFERENT genres that would make excellent mashups or creative blends with this source track.

Focus on:
1. Harmonic compatibility — same or adjacent Camelot keys work best
2. BPM compatibility — within ±8 BPM, or half/double time relationships
3. Creative contrast — different genres that create an interesting juxtaposition
4. Structural compatibility — similar phrase lengths, compatible energy

Return ONLY valid JSON, no markdown:
{
  "sourceKey": "the Camelot key of the source track if you know it, or null",
  "sourceBpm": the BPM of the source track if you know it as a number or null,
  "candidates": [
    {
      "artist": "Artist Name",
      "title": "Track Title",
      "bpm": 126,
      "key": "8A",
      "genre": "Genre",
      "bpmDelta": 2,
      "keyRelationship": "perfect|adjacent|relative|energyshift|doubletime|halftime",
      "whyItWorks": "1-2 sentences on why this mashup is interesting and what the creative contrast is",
      "technique": "Specific technique: which elements to layer, what frequency to cut, timing advice"
    }
  ]
}`

    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL, max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw  = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json(data)
  } catch (err) {
    console.error('[POST /api/mashup]', err)
    return NextResponse.json({ error: 'Failed to find mashup candidates.' }, { status: 500 })
  }
}
