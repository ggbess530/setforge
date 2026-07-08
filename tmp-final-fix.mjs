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

async function fillOne({ genre, targetKey, targetEnergy, bpmHint, avoid }) {
  const prompt = `You are a world-class DJ. Suggest exactly ONE real ${genre} track — it must be a genuinely iconic, blockbuster-famous track, the kind that would appear on a "greatest ${genre} tracks of all time" list. Not a deep cut, not an obscure release — only pick something so famous you would bet your career it's real and easy to verify.

DO NOT suggest any of these: ${avoid.join(', ')}

Camelot key MUST be exactly "${targetKey}". Target energy ${targetEnergy}/10. BPM around ${bpmHint}.

Respond ONLY with valid JSON, no markdown:
{ "artist": "...", "title": "...", "bpm": <int>, "key": "${targetKey}", "transition": "specific mix note into the next track" }`

  const msg = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 400, messages: [{ role: 'user', content: prompt }] })
  const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return parseWithRecovery(raw)
}

// Set 2 gaps: n4 needs 7A (~121bpm, E6), n5 needs 8A (~121bpm, E7)
const set2Avoid = ['Âme — Rej', 'Black Coffee — Drive', 'Black Coffee & Pharrell Williams — 10 Missed Calls', 'Black Coffee — We Dance Again', 'Hyenah — Back to the Wild', 'Enoo Napa — Air', 'Themba — Ndlovu']
const s2n4 = await fillOne({ genre:'Afro House', targetKey:'7A', targetEnergy:6, bpmHint:121, avoid:set2Avoid })
console.log('Set2 n4 (7A):', s2n4)
const s2n5 = await fillOne({ genre:'Afro House', targetKey:'8A', targetEnergy:7, bpmHint:121, avoid:[...set2Avoid, `${s2n4.artist} — ${s2n4.title}`] })
console.log('Set2 n5 (8A):', s2n5)

// Set 3 gaps: n1 needs 3A (~137bpm E7), n3 needs 3B (~139bpm E9), n4 needs 8B (~140bpm E10), n5 needs 7B (~141bpm E10)
const set3Avoid = ['Charlotte de Witte — Doppler', 'Enrico Sangiuliano — Astral Projection', 'Alignment — Spectrum', 'SPFDJ — Chaos', 'Alignment — Cell Division', 'Alignment — Mamba']
const s3n1 = await fillOne({ genre:'Peak Time Techno', targetKey:'3A', targetEnergy:7, bpmHint:137, avoid:set3Avoid })
console.log('Set3 n1 (3A):', s3n1)
const s3n3 = await fillOne({ genre:'Peak Time Techno', targetKey:'3B', targetEnergy:9, bpmHint:139, avoid:[...set3Avoid, `${s3n1.artist} — ${s3n1.title}`] })
console.log('Set3 n3 (3B):', s3n3)
const s3n4 = await fillOne({ genre:'Peak Time Techno', targetKey:'8B', targetEnergy:10, bpmHint:140, avoid:[...set3Avoid, `${s3n1.artist} — ${s3n1.title}`, `${s3n3.artist} — ${s3n3.title}`] })
console.log('Set3 n4 (8B):', s3n4)
const s3n5 = await fillOne({ genre:'Peak Time Techno', targetKey:'7B', targetEnergy:10, bpmHint:141, avoid:[...set3Avoid, `${s3n1.artist} — ${s3n1.title}`, `${s3n3.artist} — ${s3n3.title}`, `${s3n4.artist} — ${s3n4.title}`] })
console.log('Set3 n5 (7B):', s3n5)

fs.writeFileSync('final-fix-output.json', JSON.stringify({ s2n4, s2n5, s3n1, s3n3, s3n4, s3n5 }, null, 2))
