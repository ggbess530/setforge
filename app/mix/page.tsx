// ▸ Create folder: app/mix/
// ▸ Place at:      app/mix/page.tsx

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { calcBridge, type TrackMeta } from '@/lib/mix-utils'

const C = '#00f0ff'
const M = '#ff1e8a'

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

function TrackInput({ label, value, onChange, isMobile }: {
  label: string
  value: TrackMeta & { energy: number }
  onChange: (v: Partial<TrackMeta & { energy: number }>) => void
  isMobile?: boolean
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
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:10 }}>
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
  const [mode,    setMode]    = useState<'mix'|'mashup'>('mix')
  const [track1, setTrack1] = useState<TrackMeta & { energy: number }>({ ...EMPTY })
  const [track2, setTrack2] = useState<TrackMeta & { energy: number }>({ ...EMPTY })
  const [loading,    setLoading]   = useState(false)
  // Mashup finder state
  const [mArtist,    setMArtist]   = useState('')
  const [mTitle,     setMTitle]    = useState('')
  const [mBpm,       setMBpm]      = useState<number|undefined>()
  const [mKey,       setMKey]      = useState('')
  const [mResults,   setMResults]  = useState<{
    sourceKey?:string; sourceBpm?:number;
    candidates:{artist:string;title:string;bpm:number;key:string;genre:string;bpmDelta:number;keyRelationship:string;whyItWorks:string;technique:string}[]
  }|null>(null)
  const [mLoading,   setMLoading]  = useState(false)
  const [mError,     setMError]    = useState<string|null>(null)
  const [aiTips, setAiTips]     = useState<{ technique:string; eqTips:string; timing:string; warning?:string } | null>(null)
  const [error, setError]       = useState<string|null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const canSimulate = track1.bpm > 0 && track2.bpm > 0 && track1.key && track2.key
  const bridge = canSimulate ? calcBridge(track1, track2, track1.energy, track2.energy) : null

  async function findMashups() {
    if (!mArtist && !mTitle) return
    setMLoading(true); setMError(null); setMResults(null)
    try {
      const res  = await fetch('/api/mashup', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ artist: mArtist, title: mTitle, bpm: mBpm, key: mKey }),
      })
      const data = await res.json()
      if (!res.ok) { setMError(data.error || 'Failed.'); return }
      setMResults(data)
    } catch { setMError('Network error.') }
    finally   { setMLoading(false) }
  }

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
    <div style={{ minHeight: isMobile ? '100dvh' : '100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif", overflowX:'hidden' }}>
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
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(16px)', background:'rgba(6,6,12,.88)', padding: isMobile ? '0 10px' : '0 24px', overflowX:'auto' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
          <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 8 : 16 }}>
            <Link href="/" style={{ textDecoration:'none' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: isMobile ? 20 : 24, letterSpacing:2 }}>
                <span style={{ color:C }}>SET</span><span style={{ color:M }}>FORGE</span>
              </div>
            </Link>
            {!isMobile && (
              <div style={{ fontSize:12, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>/ MIX SIMULATOR</div>
            )}
          </div>
          <div style={{ display:'flex', gap: isMobile ? 6 : 12, alignItems:'center' }}>
            <Link href="/app" style={{ textDecoration:'none' }}>
              <button className="btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 16px', borderRadius:8, fontSize:13, whiteSpace:'nowrap' }}>⚡{!isMobile && ' Forge a set'}</button>
            </Link>
            <Link href="/analyse" style={{ textDecoration:'none' }}>
              <button className="btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 16px', borderRadius:8, fontSize:13, whiteSpace:'nowrap' }}>🔍{!isMobile && ' Analyse'}</button>
            </Link>
            <UserButton />
          </div>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:1, maxWidth:900, margin:'0 auto', padding:'48px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontSize:11, color:M, fontFamily:'JetBrains Mono,monospace', letterSpacing:3, marginBottom:12 }}>MIX LAB</div>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(42px,7vw,80px)', margin:'0 0 24px', letterSpacing:2, lineHeight:1 }}>
            <span style={{ color:C }}>MIX</span> <span style={{ color:'#e8e8f0' }}>&</span> <span style={{ color:M }}>MASHUP</span>
          </h1>

          {/* Mode tabs */}
          <div style={{ display:'inline-flex', border:'1px solid #1f1f33', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
            {([['mix','🎛️ Mix Simulator'],['mashup','⚡ Mashup Finder']] as const).map(([m,label]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding:'10px 28px', border:'none', cursor:'pointer', fontSize:14, fontWeight:600,
                  fontFamily:'Inter,sans-serif', transition:'.2s',
                  background: mode===m ? `linear-gradient(110deg,${M}33,${C}33)` : '#0a0a14',
                  color: mode===m ? '#e8e8f0' : '#6a6a8a',
                  borderBottom: `2px solid ${mode===m ? C : 'transparent'}` }}>
                {label}
              </button>
            ))}
          </div>

          <p style={{ fontSize:15, color:'#6a6a8a', maxWidth:520, margin:'0 auto', lineHeight:1.7 }}>
            {mode === 'mix'
              ? 'Enter BPM and key for two tracks — get instant compatibility score and mixing techniques.'
              : 'Enter any track — discover cross-genre mashup candidates with compatible keys and BPMs.'}
          </p>
        </div>

        {/* ── MIX SIMULATOR ── */}
        {mode === 'mix' && (<>
        {/* Track inputs */}
        <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
          <TrackInput label="TRACK 1 — OUTGOING" value={track1}
            onChange={v => setTrack1(prev => ({ ...prev, ...v }))}
            isMobile={isMobile}
          />

          {/* Arrow */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, width:40 }}>
            <div style={{ fontSize:24, color:'#3a3a58' }}>→</div>
          </div>

          <TrackInput label="TRACK 2 — INCOMING" value={track2}
            onChange={v => setTrack2(prev => ({ ...prev, ...v }))}
            isMobile={isMobile}
          />
        </div>

        {/* Live compatibility result */}
        {bridge && (
          <div style={{ background:'#0a0a14', border:`1.5px solid ${bridge.color}44`, borderRadius:18, padding:28, marginBottom:20 }}>
            <div style={{ display:'flex', gap:28, alignItems:'center', flexWrap:'wrap' }}>

              {/* Score arc */}
              <ScoreArc score={bridge.score} />

              {/* Details */}
              <div style={{ flex:1, minWidth: isMobile ? '100%' : 280, display:'flex', flexDirection:'column', gap:14 }}>
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
        </>)}

        {/* ── MASHUP FINDER ── */}
        {mode === 'mashup' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Source track input */}
            <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:24 }}>
              <div style={{ fontSize:10, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:16 }}>SOURCE TRACK</div>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>ARTIST</div>
                  <input value={mArtist} onChange={e=>setMArtist(e.target.value)} placeholder="e.g. Fisher"
                    className="sf-input" onKeyDown={e=>e.key==='Enter'&&findMashups()} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>TRACK TITLE</div>
                  <input value={mTitle} onChange={e=>setMTitle(e.target.value)} placeholder="e.g. Losing It"
                    className="sf-input" onKeyDown={e=>e.key==='Enter'&&findMashups()} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>BPM <span style={{ color:'#3a3a58' }}>optional</span></div>
                  <input value={mBpm||''} onChange={e=>setMBpm(parseFloat(e.target.value)||undefined)}
                    placeholder="125" type="number" className="sf-input" />
                </div>
                <div>
                  <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>CAMELOT KEY <span style={{ color:'#3a3a58' }}>optional</span></div>
                  <input value={mKey} onChange={e=>setMKey(e.target.value.toUpperCase())}
                    placeholder="8A" className="sf-input" style={{ fontFamily:'JetBrains Mono,monospace' }} />
                </div>
                <div style={{ display:'flex', alignItems:'flex-end' }}>
                  <button onClick={findMashups} disabled={mLoading||(!mArtist&&!mTitle)}
                    className="btn-cta" style={{ width:'100%', padding:'10px 0', borderRadius:8, fontSize:13,
                      opacity:mLoading||(!mArtist&&!mTitle)?.6:1 }}>
                    {mLoading ? 'Finding…' : '⚡ Find Mashups'}
                  </button>
                </div>
              </div>
              {mLoading && (
                <div style={{ fontSize:11, color:C, fontFamily:'JetBrains Mono,monospace', animation:'pulse 1.2s infinite' }}>
                  Searching across genres for compatible tracks…
                </div>
              )}
            </div>

            {mError && (
              <div style={{ padding:12, border:`1px solid ${M}`, borderRadius:10, color:M, fontSize:13 }}>{mError}</div>
            )}

            {/* Results */}
            {mResults && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {mResults.sourceKey && (
                  <div style={{ fontSize:12, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace' }}>
                    Source: <span style={{ color:C }}>{mResults.sourceBpm} BPM</span> · <span style={{ color:'#9a9ab8' }}>{mResults.sourceKey}</span> · {mResults.candidates.length} mashup candidates found
                  </div>
                )}
                {mResults.candidates.map((c, i) => {
                  const relColor = c.keyRelationship === 'perfect' ? '#4ade80'
                    : c.keyRelationship === 'adjacent' ? C
                    : c.keyRelationship === 'relative' ? '#a78bfa'
                    : c.keyRelationship === 'doubletime' || c.keyRelationship === 'halftime' ? '#f59e0b'
                    : '#f59e0b'
                  return (
                    <div key={i} style={{ background:'#0a0a14', border:`1px solid ${relColor}33`, borderRadius:14, padding:20 }}>
                      <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                        {/* Score circle */}
                        <div style={{ width:52, height:52, borderRadius:'50%', background:`${relColor}18`,
                          border:`2px solid ${relColor}55`, display:'flex', alignItems:'center',
                          justifyContent:'center', flexShrink:0, flexDirection:'column' }}>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:relColor, lineHeight:1 }}>
                            {c.key}
                          </div>
                          <div style={{ fontSize:8, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>
                            {c.bpm}
                          </div>
                        </div>
                        {/* Track info */}
                        <div style={{ flex:1, minWidth:200 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                            <div style={{ fontSize:15, fontWeight:700, color:'#e8e8f0' }}>{c.title}</div>
                            <span style={{ fontSize:10, color:relColor, border:`1px solid ${relColor}44`,
                              borderRadius:999, padding:'2px 8px', fontFamily:'JetBrains Mono,monospace' }}>
                              {c.keyRelationship.toUpperCase()}
                            </span>
                            <span style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33',
                              borderRadius:999, padding:'2px 8px' }}>{c.genre}</span>
                          </div>
                          <div style={{ fontSize:13, color:'#8a8aa8', marginBottom:8 }}>
                            {c.artist} · {c.bpmDelta > 0 ? '+' : ''}{c.bpmDelta} BPM
                          </div>
                          <div style={{ fontSize:13, color:'#c8c8e0', lineHeight:1.6, marginBottom:8 }}>
                            {c.whyItWorks}
                          </div>
                          <div style={{ background:`${relColor}0a`, border:`1px solid ${relColor}22`,
                            borderRadius:8, padding:'8px 12px', fontSize:12, color:'#9a9ab8', lineHeight:1.6 }}>
                            <span style={{ color:relColor, fontWeight:600 }}>Technique: </span>{c.technique}
                          </div>
                        </div>
                        {/* Links */}
                        <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                          {[
                            ['BP','https://www.beatport.com/search?q=','#01FF95'],
                            ['SP',`https://open.spotify.com/search/`,'#1DB954'],
                            ['YT','https://www.youtube.com/results?search_query=','#FF0000'],
                          ].map(([label, base, color]) => (
                            <a key={label}
                              href={`${base}${encodeURIComponent(`${c.artist} ${c.title}`)}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ fontSize:9, color, textDecoration:'none', border:`1px solid ${color}33`,
                                borderRadius:4, padding:'3px 7px', fontFamily:'JetBrains Mono,monospace',
                                textAlign:'center' }}>
                              {label}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Education when empty */}
            {!mResults && !mLoading && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
                {[
                  { label:'What makes a good mashup?', text:'Compatible Camelot keys + close BPM. The best mashups contrast genres while sharing harmonic DNA — Tech House vocals over a Hip Hop instrumental, for example.' },
                  { label:'Half-time & double-time', text:'A 125 BPM track can work over a 62.5 BPM (halftime) or 250 BPM (doubletime) track. Changes the energy completely while keeping groove.' },
                  { label:'Key relationship types', text:'Perfect = same key. Adjacent = ±1 on the Camelot wheel. Relative = same number, A↔B switch. All work well for layering.' },
                ].map(tip => (
                  <div key={tip.label} style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:12, padding:18 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:M, marginBottom:6 }}>{tip.label}</div>
                    <div style={{ fontSize:13, color:'#6a6a8a', lineHeight:1.6 }}>{tip.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
