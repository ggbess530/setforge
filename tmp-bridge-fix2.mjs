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

async function fillOne({ genre, before, after, targetKey, targetEnergy, avoid }) {
  const prompt = `You are a world-class DJ. Suggest exactly ONE real, well-known, commercially released ${genre} track for a single slot in a set, to replace a placeholder.

Previous track: "${before.artist} — ${before.title}" (${before.bpm} BPM, ${before.key})
Next track: "${after.artist} — ${after.title}" (${after.bpm} BPM, ${after.key})

DO NOT suggest any of these — already used elsewhere in this same set: ${avoid.join(', ')}

The track you suggest MUST have Camelot key exactly "${targetKey}" — hard requirement, the only key that harmonically bridges both neighbors. Target energy ${targetEnergy}/10. BPM should sit between the neighbors' BPMs.

CRITICAL: Must be a genuinely real, existing, well-known track — will be manually fact-checked on Spotify/Beatport before publishing. Prefer extremely famous, canonical genre staples, by a DIFFERENT artist than the ones already used in this set where possible for variety.

Respond ONLY with valid JSON, no markdown:
{ "artist": "...", "title": "...", "bpm": <int>, "key": "${targetKey}", "transition": "specific mix note into the next track" }`

  const msg = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
  const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return parseWithRecovery(raw)
}

const set2Avoid = ['Âme — Rej', 'Black Coffee — Drive', 'Black Coffee & Pharrell Williams — 10 Missed Calls', 'Black Coffee — We Dance Again', 'Hyenah — Back to the Wild']

const g2n4 = await fillOne({
  genre: 'Afro House',
  before: { artist:'Black Coffee & Pharrell Williams', title:'10 Missed Calls (feat. Jozzy)', bpm:122, key:'6A' },
  after:  { artist:'(next slot, target key 8A)', title:'', bpm:121, key:'8A' },
  targetKey: '7A', targetEnergy: 6,
  avoid: set2Avoid,
})
console.log('Set2 n4 (target 7A):', g2n4)

const g2n5 = await fillOne({
  genre: 'Afro House',
  before: { artist: g2n4.artist, title: g2n4.title, bpm: g2n4.bpm, key: '7A' },
  after:  { artist:'Black Coffee', title:'We Dance Again (feat. Nakhane Toure)', bpm:120, key:'9A' },
  targetKey: '8A', targetEnergy: 7,
  avoid: [...set2Avoid, `${g2n4.artist} — ${g2n4.title}`],
})
console.log('Set2 n5 (target 8A):', g2n5)

fs.writeFileSync('bridge-fix-output2.json', JSON.stringify({ g2n4, g2n5 }, null, 2))
