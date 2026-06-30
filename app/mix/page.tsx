// ▸ Create folder: app/mix/
// ▸ Place at:      app/mix/page.tsx

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { calcBridge, type TrackMeta } from '@/lib/mix-utils'

const C = '#00f0ff'
const M = '#ff1e8a'

const GENRES = ['Tech House','House','Techno','Melodic Techno','Drum & Bass','Afro House','Hip Hop','Trance','Disco / Funk','Open Format']

function ScoreArc({ score }: { score: number }) {
  const r = 54, circ = 2 * Math.PI * r
  const color = score >= 75 ? '#4ade80' : score >= 50 ? C : score >= 30 ? '#f59e0b' : M
  const label = score >= 75 ? 'PERFECT' : score >= 50 ? 'SMOOTH' : score >= 30 ? 'RISKY' : 'CLASH'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <div style={{ position:'relative', width:130, height:130 }}>
        <svg width={130} height={130} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={65} cy={65} r={r} fill="none" stroke="#1a1a2e" strokeWidth={8} />
          <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
            strokeLinecap="round" style={{ transition:'stroke-dashoffset .8s ease' }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:38, color, lineHeight:1 }}>{score}</div>
          <div style={{ fontSize:9, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:1 }}>/100</div>
        </div>
      </div>
      <div style={{ fontSize:14, fontWeight:700, color, fontFamily:'JetBrains Mono,monospace', letterSpacing:2 }}>{label}</div>
    </div>
  )
}

function TrackInput({ label, value, onChange }: {
  label: string
  value: TrackMeta & { energy: number }
  onChange: (v: Partial<TrackMeta & { energy: number }>) => void
}) {
  return (
    <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:24, flex:1 }}>
      <div style={{ fontSize:10, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:16 }}>{label}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>ARTIST</div>
          <input value={value.artist} onChange={e => onChange({ artist: e.target.value })}
            placeholder="e.g. Fisher" className="sf-input" />
        </div>
        <div>
          <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>TRACK TITLE</div>
          <input value={value.title} onChange={e => onChange({ title: e.target.value })}
            placeholder="e.g. Losing It" className="sf-input" />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>BPM</div>
            <input value={value.bpm || ''} onChange={e => onChange({ bpm: parseFloat(e.target.value) || 0 })}
              placeholder="125" type="number" className="sf-input" />
          </div>
          <div>
            <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>CAMELOT KEY</div>
            <input value={value.key} onChange={e => onChange({ key: e.target.value.toUpperCase() })}
              placeholder="8A" className="sf-input" style={{ fontFamily:'JetBrains Mono,monospace' }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#4a4a66', marginBottom:6 }}>ENERGY LEVEL: <span style={{ color:C }}>{value.energy}/10</span></div>
          <input type="range" min={1} max={10} value={value.energy}
            onChange={e => onChange({ energy: parseInt(e.target.value) })}
            style={{ width:'100%', accentColor:C }} />
        </div>
      </div>
    </div>
  )
}

const EMPTY: TrackMeta & { energy: number } = { artist:'', title:'', bpm:0, key:'', energy:5 }

export default function MixPage() {
  const [track1, setTrack1] = useState<TrackMeta & { energy: number }>({ ...EMPTY })
  const [track2, setTrack2] = useState<TrackMeta & { energy: number }>({ ...EMPTY })
  const [loading, setLoading]   = useState(false)
  const [aiTips, setAiTips]     = useState<{ technique:string; eqTips:string; timing:string; warning?:string } | null>(null)
  const [error, setError]       = useState<string|null>(null)

  const canSimulate = track1.bpm > 0 && track2.bpm > 0 && track1.key && track2.key
  const bridge = canSimulate ? calcBridge(track1, track2, track1.energy, track2.energy) : null

  async function getAIAdvice() {
    if (!canSimulate) return
    setLoading(true); setError(null); setAiTips(null)
    try {
      const res  = await fetch('/api/mix', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track1, track2 }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to get advice.'); return }
      setAiTips(data)
    } catch { setError('Network error. Please try again.') }
    finally   { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif", overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        .sf-input { background:#06060c; border:1px solid #1f1f33; color:#e8e8f0; font-family:'Inter',sans-serif; font-size:13px; padding:9px 12px; border-radius:8px; width:100%; outline:none; transition:border-color .2s; box-sizing:border-box; }
        .sf-input:focus { border-color:${C}; }
        .btn-cta { background:linear-gradient(110deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:box-shadow .2s,transform .15s; }
        .btn-cta:hover { box-shadow:0 0 0 3px ${C}44,0 8px 40px ${C}44; transform:translateY(-1px); }
        .btn-ghost { background:transparent; border:1.5px solid #2a2a42; color:#e8e8f0; cursor:pointer; font-family:'Inter',sans-serif; transition:border-color .2s,color .2s; }
        .btn-ghost:hover { border-color:${C}; color:${C}; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        * { box-sizing:border-box; }
      `}</style>

      {/* bg */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C}06 1px,transparent 1px),linear-gradient(90deg,${C}06 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 0%,black,transparent 70%)', pointerEvents:'none', zIndex:0 }} />

      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(16px)', background:'rgba(6,6,12,.88)', padding:'0 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <Link href="/" style={{ textDecoration:'none' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>
                <span style={{ color:C }}>SET</span><span style={{ color:M }}>FORGE</span>
              </div>
            </Link>
            <div style={{ fontSize:12, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>/ MIX SIMULATOR</div>
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <Link href="/app" style={{ textDecoration:'none' }}>
              <button className="btn-ghost" style={{ padding:'7px 16px', borderRadius:8, fontSize:13 }}>⚡ Forge a set</button>
            </Link>
            <Link href="/analyse" style={{ textDecoration:'none' }}>
              <button className="btn-ghost" style={{ padding:'7px 16px', borderRadius:8, fontSize:13 }}>🔍 Analyse</button>
            </Link>
            <UserButton />
          </div>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:1, maxWidth:900, margin:'0 auto', padding:'48px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ fontSize:11, color:M, fontFamily:'JetBrains Mono,monospace', letterSpacing:3, marginBottom:12 }}>MIX SIMULATOR</div>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(42px,7vw,80px)', margin:'0 0 16px', letterSpacing:2, lineHeight:1 }}>
            <span style={{ color:C }}>WILL THESE</span><br />
            <span style={{ color:'#e8e8f0' }}>TWO TRACKS MIX?</span>
          </h1>
          <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:520, margin:'0 auto', lineHeight:1.7 }}>
            Enter BPM and Camelot key for any two tracks — get an instant compatibility score, key relationship analysis, and specific mixing techniques.
          </p>
        </div>

        {/* Track inputs */}
        <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
          <TrackInput label="TRACK 1 — OUTGOING" value={track1} onChange={v => setTrack1(prev => ({ ...prev, ...v }))} />

          {/* Arrow */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, width:40 }}>
            <div style={{ fontSize:24, color:'#3a3a58' }}>→</div>
          </div>

          <TrackInput label="TRACK 2 — INCOMING" value={track2} onChange={v => setTrack2(prev => ({ ...prev, ...v }))} />
        </div>

        {/* Live compatibility result */}
        {bridge && (
          <div style={{ background:'#0a0a14', border:`1.5px solid ${bridge.color}44`, borderRadius:18, padding:28, marginBottom:20 }}>
            <div style={{ display:'flex', gap:28, alignItems:'center', flexWrap:'wrap' }}>

              {/* Score arc */}
              <ScoreArc score={bridge.score} />

              {/* Details */}
              <div style={{ flex:1, minWidth:280, display:'flex', flexDirection:'column', gap:14 }}>
                {/* Key */}
                <div style={{ background:'#06060c', borderRadius:10, padding:'12px 16px' }}>
                  <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', letterSpacing:1, marginBottom:4 }}>HARMONIC COMPATIBILITY</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:15, color:'#e8e8f0', fontWeight:700 }}>
                      {track1.key} → {track2.key}
                    </div>
                    <span style={{ fontSize:10, color:bridge.color, border:`1px solid ${bridge.color}55`, borderRadius:999, padding:'2px 8px', fontFamily:'JetBrains Mono,monospace', fontWeight:700 }}>
                      {bridge.keyRelationship.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:'#9a9ab8', marginTop:4 }}>{bridge.keyNote}</div>
                </div>

                {/* BPM */}
                <div style={{ background:'#06060c', borderRadius:10, padding:'12px 16px' }}>
                  <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', letterSpacing:1, marginBottom:4 }}>BPM TRANSITION</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:15, color:'#e8e8f0', fontWeight:700 }}>
                      {track1.bpm} → {track2.bpm}
                    </div>
                    <span style={{ fontSize:12, color: Math.abs(bridge.bpmDelta) <= 5 ? '#4ade80' : '#f59e0b', fontFamily:'JetBrains Mono,monospace' }}>
                      {bridge.bpmDelta > 0 ? '+' : ''}{bridge.bpmDelta} BPM
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:'#9a9ab8', marginTop:4 }}>{bridge.bpmNote}</div>
                </div>

                {/* Technique */}
                <div style={{ background:`${bridge.color}0e`, border:`1px solid ${bridge.color}33`, borderRadius:10, padding:'12px 16px' }}>
                  <div style={{ fontSize:9, color:bridge.color, fontFamily:'JetBrains Mono,monospace', letterSpacing:1, marginBottom:4 }}>💡 TECHNIQUE</div>
                  <div style={{ fontSize:13, color:'#c8c8e0', lineHeight:1.6 }}>{bridge.technique}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI deep dive button */}
        {canSimulate && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <button onClick={getAIAdvice} disabled={loading} className="btn-cta"
              style={{ padding:'13px 36px', borderRadius:10, fontSize:15, opacity:loading?.6:1 }}>
              {loading ? 'Getting AI advice…' : '🤖 Get detailed AI mixing advice'}
            </button>
            <div style={{ fontSize:12, color:'#4a4a66', marginTop:8 }}>
              Specific EQ settings, timing cues, and crowd management tips
            </div>
          </div>
        )}

        {!canSimulate && (
          <div style={{ textAlign:'center', padding:'32px 0', color:'#4a4a66', fontSize:14 }}>
            Enter BPM and Camelot key for both tracks to see compatibility
          </div>
        )}

        {error && (
          <div style={{ padding:14, border:`1px solid ${M}`, borderRadius:10, color:M, fontSize:13, marginBottom:16 }}>{error}</div>
        )}

        {/* AI advice panel */}
        {aiTips && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'MIXING TECHNIQUE', content: aiTips.technique, color: C },
              { label:'EQ & FX TIPS',     content: aiTips.eqTips,    color: '#a78bfa' },
              { label:'TIMING & CUES',    content: aiTips.timing,    color: '#4ade80' },
            ].map(s => (
              <div key={s.label} style={{ background:'#0a0a14', border:`1px solid ${s.color}33`, borderRadius:12, padding:'16px 20px' }}>
                <div style={{ fontSize:9, color:s.color, fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:8, fontWeight:700 }}>{s.label}</div>
                <div style={{ fontSize:14, color:'#c8c8e0', lineHeight:1.7 }}>{s.content}</div>
              </div>
            ))}
            {aiTips.warning && (
              <div style={{ background:'#1a0a0a', border:`1px solid ${M}44`, borderRadius:12, padding:'14px 18px' }}>
                <div style={{ fontSize:9, color:M, fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:6, fontWeight:700 }}>⚠️ WATCH OUT</div>
                <div style={{ fontSize:14, color:'#c8c8e0', lineHeight:1.7 }}>{aiTips.warning}</div>
              </div>
            )}
          </div>
        )}

        {/* Info section */}
        {!bridge && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginTop:32 }}>
            {[
              { label:'What is Camelot?', text:'The Camelot system maps musical keys to numbers (1-12) and letters (A=minor, B=major). Adjacent numbers mix smoothly.' },
              { label:'Compatible keys', text:'Same number (8A+8A), ±1 same letter (8A+9A), relative switch (8A+8B), or +7 energy boost.' },
              { label:'BPM range', text:'±2 BPM is seamless. ±5 is manageable. Beyond ±10 requires a breakdown drop or tempo-neutral intro.' },
            ].map(tip => (
              <div key={tip.label} style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:12, padding:18 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C, marginBottom:6 }}>{tip.label}</div>
                <div style={{ fontSize:13, color:'#6a6a8a', lineHeight:1.6 }}>{tip.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
