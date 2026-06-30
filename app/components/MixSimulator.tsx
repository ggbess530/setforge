// ▸ Place at: app/components/MixSimulator.tsx
// Inline mix simulator — shown in the set results panel

'use client'

import { useState } from 'react'
import { calcBridge, type BridgeData } from '@/lib/mix-utils'

const C = '#00f0ff'
const M = '#ff1e8a'

interface Track {
  n:      number
  artist: string
  title:  string
  bpm:    number
  key:    string
  energy: number
}

interface Props {
  tracks: Track[]
}

function CompatBadge({ c }: { c: BridgeData['compatibility'] }) {
  const cfg = {
    perfect: { color:'#4ade80', label:'PERFECT' },
    smooth:  { color:C,         label:'SMOOTH'  },
    risky:   { color:'#f59e0b', label:'RISKY'   },
    clash:   { color:M,         label:'CLASH'   },
  }[c]
  return (
    <span style={{ fontSize:9, fontWeight:700, color:cfg.color, border:`1px solid ${cfg.color}55`,
      borderRadius:999, padding:'2px 8px', fontFamily:'JetBrains Mono,monospace', letterSpacing:1 }}>
      {cfg.label}
    </span>
  )
}

export default function MixSimulator({ tracks }: Props) {
  const [expanded, setExpanded] = useState<number|null>(null)

  if (tracks.length < 2) return null

  const bridges = tracks.slice(0, -1).map((t, i) =>
    calcBridge(t, tracks[i + 1], t.energy, tracks[i + 1].energy)
  )

  const avgScore = Math.round(bridges.reduce((s, b) => s + b.score, 0) / bridges.length)
  const worstIdx = bridges.reduce((wi, b, i) => b.score < bridges[wi].score ? i : wi, 0)

  return (
    <div style={{ marginTop:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace' }}>MIX SIMULATOR</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:11, color:'#6a6a8a' }}>
            Set score: <span style={{ color: avgScore >= 75 ? '#4ade80' : avgScore >= 50 ? C : '#f59e0b', fontWeight:700 }}>{avgScore}/100</span>
          </div>
          <div style={{ fontSize:11, color:'#f59e0b' }}>
            Hardest mix: <span style={{ fontWeight:700 }}>Track {worstIdx + 1}→{worstIdx + 2}</span>
          </div>
        </div>
      </div>

      {/* Flow diagram */}
      <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:14, padding:'16px 12px', overflowX:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', minWidth: tracks.length * 180 }}>
          {tracks.map((t, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex: i < tracks.length - 1 ? 1 : 0 }}>

              {/* Track node */}
              <div style={{ flexShrink:0, textAlign:'center', width:110 }}>
                <div style={{ background:'#0a0a14', border:`1.5px solid ${i === worstIdx || i === worstIdx + 1 ? '#f59e0b44' : '#1a1a2e'}`, borderRadius:10, padding:'8px 10px' }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:M, lineHeight:1 }}>
                    {String(t.n).padStart(2,'0')}
                  </div>
                  <div style={{ fontSize:10, color:'#e8e8f0', fontWeight:600, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:90 }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize:9, color:'#6a6a8a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:90 }}>
                    {t.artist}
                  </div>
                  <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:4 }}>
                    <span style={{ fontSize:9, color:C, fontFamily:'JetBrains Mono,monospace' }}>{t.bpm}</span>
                    <span style={{ fontSize:9, color:'#6a6a8a' }}>·</span>
                    <span style={{ fontSize:9, color:'#9a9ab8', fontFamily:'JetBrains Mono,monospace' }}>{t.key}</span>
                  </div>
                </div>
              </div>

              {/* Bridge */}
              {i < tracks.length - 1 && (
                <div style={{ flex:1, padding:'0 4px', cursor:'pointer' }}
                  onClick={() => setExpanded(expanded === i ? null : i)}>
                  <div style={{ position:'relative' }}>
                    {/* Line */}
                    <div style={{ height:2, background:`linear-gradient(90deg, ${bridges[i].color}88, ${bridges[i].color}, ${bridges[i].color}88)`, borderRadius:1 }} />
                    {/* Centre badge */}
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#06060c', padding:'2px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:2, whiteSpace:'nowrap' }}>
                      <CompatBadge c={bridges[i].compatibility} />
                      <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>
                        {bridges[i].bpmDelta > 0 ? '+' : ''}{bridges[i].bpmDelta} BPM
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {expanded === i && (
                    <div style={{ marginTop:8, background:'#0a0a14', border:`1px solid ${bridges[i].color}44`, borderRadius:10, padding:'12px 14px', position:'relative', zIndex:10 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', letterSpacing:1, marginBottom:3 }}>KEY</div>
                          <div style={{ fontSize:11, color:'#e8e8f0', fontWeight:600 }}>{t.key} → {tracks[i+1].key}</div>
                          <div style={{ fontSize:10, color:'#9a9ab8', lineHeight:1.5 }}>{bridges[i].keyNote}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', letterSpacing:1, marginBottom:3 }}>BPM</div>
                          <div style={{ fontSize:11, color:'#e8e8f0', fontWeight:600 }}>{t.bpm} → {tracks[i+1].bpm}</div>
                          <div style={{ fontSize:10, color:'#9a9ab8', lineHeight:1.5 }}>{bridges[i].bpmNote}</div>
                        </div>
                      </div>
                      <div style={{ borderTop:'1px solid #1a1a2e', paddingTop:8 }}>
                        <div style={{ fontSize:9, color:C, fontFamily:'JetBrains Mono,monospace', letterSpacing:1, marginBottom:4 }}>💡 TECHNIQUE</div>
                        <div style={{ fontSize:11, color:'#c8c8e0', lineHeight:1.6 }}>{bridges[i].technique}</div>
                      </div>
                      <div style={{ marginTop:6, display:'flex', justifyContent:'flex-end' }}>
                        <div style={{ fontSize:9, color:bridges[i].color, fontFamily:'JetBrains Mono,monospace' }}>
                          MIX SCORE: {bridges[i].score}/100
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
        {[['#4ade80','Perfect (75+)'],['#00f0ff','Smooth (50-74)'],['#f59e0b','Risky (30-49)'],['#ff1e8a','Clash (<30)']].map(([color,label]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#4a4a66' }}>
            <div style={{ width:16, height:2, background:color, borderRadius:1 }} />
            {label}
          </div>
        ))}
        <div style={{ fontSize:10, color:'#4a4a66', marginLeft:'auto' }}>Tap any bridge for technique tips</div>
      </div>
    </div>
  )
}
