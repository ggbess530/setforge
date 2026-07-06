// ▸ Place at: lib/mix-utils.ts
// Shared compatibility logic used by both inline simulator and /mix page

export interface TrackMeta {
  artist: string
  title:  string
  bpm:    number
  key:    string
}

export interface BridgeData {
  compatibility:  'perfect' | 'smooth' | 'risky' | 'clash'
  color:          string
  bpmDelta:       number
  bpmNote:        string
  keyRelationship: string
  keyNote:        string
  technique:      string
  score:          number   // 0-100
}

// ── Camelot compatibility ──────────────────────────────────────
export function camelotCompatibility(k1: string, k2: string): {
  type: 'perfect' | 'adjacent' | 'relative' | 'energyshift' | 'clash'
  note: string
} {
  if (!k1 || !k2) return { type: 'clash', note: 'Key unknown' }

  const m1 = k1.toUpperCase().match(/^(\d+)([AB])$/)
  const m2 = k2.toUpperCase().match(/^(\d+)([AB])$/)
  if (!m1 || !m2) return { type: 'clash', note: 'Invalid key format' }

  const n1 = parseInt(m1[1]), t1 = m1[2]
  const n2 = parseInt(m2[1]), t2 = m2[2]

  // Perfect match
  if (n1 === n2 && t1 === t2) return { type: 'perfect', note: 'Same key — perfect harmonic lock' }

  // Relative switch (same number, A↔B)
  if (n1 === n2 && t1 !== t2) return { type: 'relative', note: `Relative ${t1 === 'A' ? 'major' : 'minor'} switch — emotional shift` }

  // Adjacent on wheel (±1, wrapping 12→1)
  const diff = Math.min(
    Math.abs(n1 - n2),
    12 - Math.abs(n1 - n2)
  )
  if (diff === 1 && t1 === t2) return { type: 'adjacent', note: 'Adjacent key — natural energy lift or drop' }

  // Energy boost (+7 semitones = same letter, +5 positions)
  if (diff === 7 && t1 === t2) return { type: 'energyshift', note: 'Energy boost jump — dramatic but effective' }

  return { type: 'clash', note: `Key clash (${k1}→${k2}) — crowd may notice` }
}

// ── BPM compatibility ─────────────────────────────────────────
export function bpmCompatibility(b1: number, b2: number): {
  delta: number
  note:  string
  ok:    boolean
} {
  if (!b1 || !b2) return { delta: 0, note: 'BPM unknown', ok: false }
  const delta = b2 - b1
  const abs   = Math.abs(delta)

  if (abs === 0)       return { delta, note: 'Identical BPM — seamless sync',         ok: true  }
  if (abs <= 2)        return { delta, note: `${Math.abs(delta)} BPM nudge — easy`,    ok: true  }
  if (abs <= 5)        return { delta, note: `${Math.abs(delta)} BPM shift — manageable`, ok: true }
  if (abs <= 10)       return { delta, note: `${Math.abs(delta)} BPM jump — requires skill`, ok: false }
  // Check if halftime/doubletime works
  const ratio = b2 / b1
  if (Math.abs(ratio - 2) < 0.05 || Math.abs(ratio - 0.5) < 0.05) {
    return { delta, note: 'Half/double time trick possible', ok: true }
  }
  return { delta, note: `${Math.abs(delta)} BPM gap — very difficult`, ok: false }
}

// ── Technique suggestion ──────────────────────────────────────
export function getTechnique(key: ReturnType<typeof camelotCompatibility>, bpm: ReturnType<typeof bpmCompatibility>, energyDelta: number): string {
  const parts: string[] = []

  if (bpm.delta > 5)        parts.push(`Pitch the incoming track down ${Math.abs(bpm.delta)} BPM during the breakdown`)
  else if (bpm.delta < -5)  parts.push(`Speed up the incoming track ${Math.abs(bpm.delta)} BPM in the mix`)
  else if (Math.abs(bpm.delta) <= 2) parts.push('Sync on the downbeat, let both tracks play 32 bars')

  if (key.type === 'clash')  parts.push('Use a high-pass filter sweep to mask the key change')
  if (key.type === 'relative') parts.push('Mix through the breakdown where melody is sparse')
  if (key.type === 'adjacent') parts.push('Blend openly — the harmonic shift sounds intentional')
  if (key.type === 'perfect') parts.push('Full blend — keep both playing for 64+ bars')

  if (energyDelta > 2)      parts.push('Drop the bass early on the incoming track to control the energy spike')
  if (energyDelta < -2)     parts.push('Ease the outgoing track with EQ before bringing in the new one')

  return parts.length ? parts.join('. ') + '.' : 'Standard beatmatch blend on the intro.'
}

// ── Master bridge calculator ───────────────────────────────────
export function calcBridge(t1: TrackMeta, t2: TrackMeta, e1 = 5, e2 = 5): BridgeData {
  const keyResult = camelotCompatibility(t1.key, t2.key)
  const bpmResult = bpmCompatibility(t1.bpm, t2.bpm)
  const energyDelta = e2 - e1

  // Score: 0-100
  const keyScore = { perfect: 40, adjacent: 35, relative: 30, energyshift: 20, clash: 0 }[keyResult.type]
  const bpmScore = bpmResult.ok ? 40 : Math.max(0, 40 - Math.abs(bpmResult.delta) * 3)
  const energyScore = Math.max(0, 20 - Math.abs(energyDelta) * 2)
  const score = keyScore + bpmScore + energyScore

  const compatibility = score >= 75 ? 'perfect'
                      : score >= 50 ? 'smooth'
                      : score >= 30 ? 'risky'
                      : 'clash'

  const color = { perfect: '#4ade80', smooth: '#00f0ff', risky: '#f59e0b', clash: '#ff1e8a' }[compatibility]

  return {
    compatibility,
    color,
    bpmDelta:        bpmResult.delta,
    bpmNote:         bpmResult.note,
    keyRelationship: keyResult.type,
    keyNote:         keyResult.note,
    technique:       getTechnique(keyResult, bpmResult, energyDelta),
    score,
  }
}
