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

async function fillOne({ genre, before, after, targetKey, targetEnergy }) {
  const prompt = `You are a world-class DJ. Suggest exactly ONE real, well-known, commercially released ${genre} track for a single slot in a set, to replace a placeholder.

Previous track: "${before.artist} — ${before.title}" (${before.bpm} BPM, ${before.key})
Next track: "${after.artist} — ${after.title}" (${after.bpm} BPM, ${after.key})

The track you suggest MUST have Camelot key exactly "${targetKey}" — this is a hard requirement, not a suggestion, because it's the only key that harmonically bridges both neighbors correctly. Target energy ${targetEnergy}/10. BPM should sit between the neighbors' BPMs.

CRITICAL: This must be a genuinely real, existing, well-known track — it will be manually fact-checked on Spotify/Beatport before publishing. Prefer extremely famous, canonical genre staples.

Respond ONLY with valid JSON, no markdown:
{ "artist": "...", "title": "...", "bpm": <int>, "key": "${targetKey}", "transition": "specific mix note into the next track" }`

  const msg = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
  const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return parseWithRecovery(raw)
}

// Set 2 fix: n3(6A,Black Coffee&Pharrell) -> n4(?) -> n5(9A currently, Solomun-Kater) -> n6(9A locked)
// Need n3(6A) -> n4 -> n5 -> n6(9A) as clean adjacent walk: 6A -> 7A -> 8A -> 9A
const g2n4 = await fillOne({
  genre: 'Afro House',
  before: { artist:'Black Coffee & Pharrell Williams', title:'10 Missed Calls (feat. Jozzy)', bpm:122, key:'6A' },
  after:  { artist:'(next slot, target key 8A)', title:'', bpm:121, key:'8A' },
  targetKey: '7A', targetEnergy: 6,
})
console.log('Set2 n4 (target 7A):', g2n4)

const g2n5 = await fillOne({
  genre: 'Afro House',
  before: { artist: g2n4.artist, title: g2n4.title, bpm: g2n4.bpm, key: '7A' },
  after:  { artist:'Black Coffee', title:'We Dance Again (feat. Nakhane Toure)', bpm:120, key:'9A' },
  targetKey: '8A', targetEnergy: 7,
})
console.log('Set2 n5 (target 8A):', g2n5)

// Set 3 fix: n3(3B, SPFDJ-Chaos) -> n4(?) -> n5(7B, Alignment-Mamba) -> n6(7B locked)
// Bridge: 3B -> 8B (energy boost, +5 reduced) -> 7B (adjacent) -> 7B (perfect)
const g3n4 = await fillOne({
  genre: 'Peak Time Techno',
  before: { artist:'SPFDJ', title:'Chaos', bpm:139, key:'3B' },
  after:  { artist:'Alignment', title:'Mamba', bpm:141, key:'7B' },
  targetKey: '8B', targetEnergy: 10,
})
console.log('Set3 n4 (target 8B):', g3n4)

fs.writeFileSync('bridge-fix-output.json', JSON.stringify({ g2n4, g2n5, g3n4 }, null, 2))
