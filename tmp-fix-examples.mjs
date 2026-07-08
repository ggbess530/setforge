import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
const key = env.match(/^ANTHROPIC_API_KEY=(.*)$/m)?.[1]?.trim()
const anthropic = new Anthropic({ apiKey: key })

function parseWithRecovery(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const start = cleaned.indexOf('{')
  let candidate = start >= 0 ? cleaned.slice(start) : cleaned
  const opens = (candidate.match(/\{/g) || []).length
  const closes = (candidate.match(/\}/g) || []).length
  const missing = opens - closes
  if (missing > 0 && missing < 5) candidate = candidate.trimEnd().replace(/,\s*$/, '') + '}'.repeat(missing)
  return JSON.parse(candidate)
}

async function fillSlots({ genre, crowd, lockedTracks, openSlots }) {
  const lockedDesc = lockedTracks.map(t => `Position ${t.n}: "${t.artist} — ${t.title}" (${t.bpm} BPM, ${t.key}, energy ${t.energy}/10) — LOCKED, do not change`).join('\n')
  const slotsDesc = openSlots.map(s => `Position ${s.n}: needs a track, target energy ${s.energy}/10, must harmonically bridge its LOCKED neighbors above`).join('\n')

  const prompt = `You are a world-class DJ. This is a ${genre} set for ${crowd}. Some slots are already locked with CONFIRMED REAL tracks; fill in ONLY the open slots with different real tracks.

LOCKED (in final position order, do not touch or repeat):
${lockedDesc}

OPEN SLOTS TO FILL:
${slotsDesc}

CRITICAL: Every track you suggest must be a genuinely real, commercially released, well-known track that definitively exists on Spotify/Beatport — this is going on a public marketing page and will be manually fact-checked, so only suggest tracks you are highly confident actually exist with this exact artist and title. Prefer extremely famous, canonical genre staples over obscure or uncertain picks. Do NOT reuse any locked track or artist+title combination.

Each open slot's key must be harmonically compatible with its immediate locked/filled neighbors: same Camelot number (A/B relative), adjacent number (±1, same letter), or same letter +7 positions (energy boost). BPM should stay within 5 of neighboring tracks.

Respond ONLY with valid JSON, no markdown, no preamble:
{ "fills": [ { "n": <position>, "artist": "...", "title": "...", "bpm": <int>, "key": "Camelot e.g. 8A", "transition": "specific mix note into the next track" } ] }`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return parseWithRecovery(raw)
}

const jobs = [
  {
    id: 'midnight-circuit', genre: 'Tech House', crowd: 'Club Peak Hour',
    lockedTracks: [
      { n:3, artist:'Fisher', title:'Losing It', bpm:125, key:'10A', energy:6 },
      { n:5, artist:'Solardo', title:'Tribesmen', bpm:127, key:'12A', energy:8 },
    ],
    openSlots: [ {n:1,energy:4}, {n:2,energy:5}, {n:6,energy:9} ],
  },
  {
    id: 'golden-hour', genre: 'Afro House', crowd: 'Rooftop / Lounge',
    lockedTracks: [
      { n:3, artist:'Black Coffee & Pharrell Williams', title:'10 Missed Calls (feat. Jozzy)', bpm:122, key:'6A', energy:7 },
      { n:6, artist:'Black Coffee', title:'We Dance Again (feat. Nakhane Toure)', bpm:120, key:'9A', energy:5 },
    ],
    openSlots: [ {n:1,energy:4}, {n:2,energy:5}, {n:4,energy:6}, {n:5,energy:7} ],
  },
  {
    id: 'voltage-spike', genre: 'Peak Time Techno', crowd: 'Festival Main Stage',
    lockedTracks: [
      { n:2, artist:'Charlotte de Witte', title:'Doppler', bpm:138, key:'3B', energy:8 },
      { n:6, artist:'Enrico Sangiuliano', title:'Astral Projection', bpm:141, key:'7B', energy:9 },
    ],
    openSlots: [ {n:1,energy:7}, {n:3,energy:9}, {n:4,energy:10}, {n:5,energy:10} ],
  },
]

const allResults = {}
for (const job of jobs) {
  const result = await fillSlots(job)
  allResults[job.id] = result
  console.log(`\n=== ${job.id} — new fills ===`)
  result.fills.forEach(f => console.log(`  ${f.n}. ${f.artist} — ${f.title} [${f.bpm} BPM, ${f.key}] :: ${f.transition}`))
}
fs.writeFileSync('fix-examples-output.json', JSON.stringify(allResults, null, 2))
