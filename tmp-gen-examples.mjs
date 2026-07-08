import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
const key = env.match(/^ANTHROPIC_API_KEY=(.*)$/m)?.[1]?.trim()
const anthropic = new Anthropic({ apiKey: key })

function buildPrompt({ genre, crowd, familiarity, bpmLow, bpmHigh, energyCurve }) {
  const exNum = 1 + Math.floor(Math.random() * 12)
  const exLetter = Math.random() < 0.5 ? 'A' : 'B'
  const exKey = `${exNum}${exLetter}`
  const exRelKey = `${exNum}${exLetter === 'A' ? 'B' : 'A'}`
  const exDownNum = exNum === 1 ? 12 : exNum - 1
  const exUpNum = exNum === 12 ? 1 : exNum + 1
  const exBoostNum = ((exNum - 1 + 7) % 12) + 1
  const exBpm = Math.round(bpmLow + Math.random() * (bpmHigh - bpmLow))
  const curveStr = energyCurve.map((e, i) => `Track ${i + 1}: energy ${e}/10`).join(', ')

  return `You are a world-class DJ set curator. Build a complete DJ set section.

Parameters:
- Genre: ${genre}
- Crowd: ${crowd}
- Track familiarity: ${familiarity}
- BPM range: ${bpmLow}–${bpmHigh}
- Track count: 6 tracks
- Energy: start ${energyCurve[0]}/10 → end ${energyCurve[energyCurve.length-1]}/10
- Custom energy per position: ${curveStr}

Respond ONLY with valid JSON, no markdown, no preamble (the field values below are placeholder illustrations, not suggested values):
{
  "title": "evocative set name (3–5 words)",
  "summary": "1 sentence describing the energy journey",
  "tracks": [
    { "n": 1, "artist": "Artist", "title": "Title", "bpm": ${exBpm}, "key": "${exKey}", "energy": 4, "transition": "mix note into next track" }
  ]
}

Rules:
- Pick REAL tracks that DEFINITIVELY exist on Spotify and Beatport — commercial releases by established artists only. Favor widely recognizable, well-known tracks for this genre since this example will be shown publicly and every track must be genuinely real and findable.
- NEVER suggest: unreleased tracks, dubplates, SoundCloud-only tracks, bootlegs, unofficial edits, or tracks you are uncertain about
- Match each track's energy to the per-position value above
- Plan the Camelot sequence as a deliberate journey around the wheel, not just a chain of individually-legal pairs: mostly step ONE position at a time in a consistent direction (e.g. steadily climbing ${exKey}→${exUpNum}${exLetter}→...) so the set covers a WIDE spread of the 1–12 range by the end, based on what genuinely fits each real track. Do NOT oscillate back and forth between the same 2–3 numbers.
- Harmonic key mixing REQUIRED. Every adjacent pair must be one of, in order of how often to use them:
  1. Adjacent step (most common): (N-1)X↔NX↔(N+1)X, 12 wraps to 1 (e.g. ${exKey}→${exUpNum}${exLetter} or ${exKey}→${exDownNum}${exLetter})
  2. Relative switch (occasional, for a mood shift): same number, A↔B (e.g. ${exKey}↔${exRelKey})
  3. Energy-boost jump (rare — a genuine peak moment only): same letter, +7 positions (e.g. ${exKey}→${exBoostNum}${exLetter})
  Anything else is a key clash. Before finalizing, silently verify every pair fits one of the 3 relationships above. Your response must still be ONLY the final JSON object.
  BPM difference between adjacent tracks should be ≤5 BPM for a clean blend.
- Transition notes should be specific (e.g. "filter sweep on the breakdown, swap kicks at the drop")`
}

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

const configs = [
  { id:'midnight-circuit', genre:'Tech House', crowd:'Club Peak Hour', familiarity:'Mix well-known tracks with some lesser-known picks — a natural blend of familiar and fresh.', bpmLow:123, bpmHigh:128, energyCurve:[4,5,6,7,8,9] },
  { id:'golden-hour', genre:'Afro House', crowd:'Rooftop / Lounge', familiarity:'Favor widely recognizable, well-known tracks and festival/radio staples for this genre — the crowd should recognize most of the set.', bpmLow:119, bpmHigh:123, energyCurve:[4,5,7,6,7,5] },
  { id:'voltage-spike', genre:'Peak Time Techno', crowd:'Festival Main Stage', familiarity:'Favor widely recognizable, well-known tracks and festival/radio staples for this genre — the crowd should recognize most of the set.', bpmLow:135, bpmHigh:142, energyCurve:[7,8,9,10,10,9] },
]

const results = []
for (const cfg of configs) {
  const prompt = buildPrompt(cfg)
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const parsed = parseWithRecovery(raw)
  results.push({ id: cfg.id, genre: cfg.genre, crowd: cfg.crowd, ...parsed })
  console.log(`\n=== ${cfg.id} (${cfg.genre} / ${cfg.crowd}) ===`)
  console.log('Title:', parsed.title)
  console.log('Summary:', parsed.summary)
  console.log('Keys:', parsed.tracks.map(t=>t.key).join(' -> '))
  console.log('BPMs:', parsed.tracks.map(t=>t.bpm).join(' -> '))
  parsed.tracks.forEach(t => console.log(`  ${t.n}. ${t.artist} — ${t.title} [${t.bpm} BPM, ${t.key}, E${t.energy}] :: ${t.transition}`))
}
fs.writeFileSync('gen-examples-output.json', JSON.stringify(results, null, 2))
