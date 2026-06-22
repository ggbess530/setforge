// ▸ Create folder: app/analyse/
// ▸ Place at:      app/analyse/page.tsx

'use client'

import { useState } from 'react'
import Link         from 'next/link'
import { UserButton, useAuth } from '@clerk/nextjs'

const C = '#00f0ff'
const M = '#ff1e8a'

// ── Types ─────────────────────────────────────────────────────
interface ScoreItem  { score: number; label: string; comment: string }
interface Improvement { title: string; detail: string }
interface TrackNote  { n: number; note: string }

interface Report {
  overview:           string
  grade:              string
  gradeReason:        string
  scores:             Record<string, ScoreItem>
  peakMoment:         { trackN:number; artist:string; title:string; reason:string }
  weakestTransition:  { fromN:number; toN:number; fromTitle:string; toTitle:string; reason:string; fix:string }
  strengths:          string[]
  improvements:       Improvement[]
  trackNotes:         TrackNote[]
  energyCurve:        number[]
  verdict:            string
}

// ── Grade config ──────────────────────────────────────────────
function gradeConfig(grade: string) {
  if (grade.startsWith('A')) return { color:'#4ade80', bg:'#4ade8011', label:'Excellent' }
  if (grade.startsWith('B')) return { color:C,         bg:`${C}11`,    label:'Good' }
  if (grade.startsWith('C')) return { color:'#f59e0b', bg:'#f59e0b11', label:'Needs Work' }
  return                             { color:M,         bg:`${M}11`,    label:'Weak' }
}

// ── Score ring ────────────────────────────────────────────────
function ScoreRing({ score, label, comment }: ScoreItem) {
  const pct  = score / 10
  const r    = 28
  const circ = 2 * Math.PI * r
  const color = score >= 8 ? '#4ade80' : score >= 6 ? C : score >= 4 ? '#f59e0b' : M

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <div style={{ position:'relative', width:72, height:72 }}>
        <svg width={72} height={72} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={36} cy={36} r={r} fill="none" stroke="#1a1a2e" strokeWidth={5} />
          <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round" style={{ transition:'stroke-dashoffset .8s ease' }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color }}>
          {score}
        </div>
      </div>
      <div style={{ fontSize:11, color:'#e8e8f0', fontWeight:600, textAlign:'center' }}>{label}</div>
      <div style={{ fontSize:10, color:'#6a6a8a', textAlign:'center', lineHeight:1.5, maxWidth:130 }}>{comment}</div>
    </div>
  )
}

// ── Energy curve chart ────────────────────────────────────────
function EnergyCurveChart({ curve, tracks }: { curve: number[]; tracks: { n:number; artist:string; title:string }[] }) {
  const [hovered, setHovered] = useState<number|null>(null)
  if (!curve?.length) return null

  const W = 600, H = 100, PAD = 20
  const uw = W - PAD * 2, uh = H - PAD * 2

  const pts = curve.map((e, i) => ({
    x: PAD + (i / (curve.length - 1)) * uw,
    y: PAD + (1 - (e - 1) / 9) * uh,
    e, i,
  }))

  // Smooth path
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i-1)], p1 = pts[i], p2 = pts[i+1], p3 = pts[Math.min(pts.length-1, i+2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  const fill = d + ` L ${pts[pts.length-1].x} ${PAD+uh} L ${pts[0].x} ${PAD+uh} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', display:'block' }}>
        <defs>
          <linearGradient id="ac-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[2,4,6,8,10].map(e => {
          const y = PAD + (1-(e-1)/9)*uh
          return <g key={e}>
            <line x1={PAD} y1={y} x2={W-PAD} y2={y} stroke="#1a1a2e" strokeWidth={1} />
            <text x={PAD-6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="#3a3a58" fontFamily="monospace">{e}</text>
          </g>
        })}
        <path d={fill} fill="url(#ac-fill)" />
        <path d={d} fill="none" stroke={C} strokeWidth={2} strokeLinecap="round" />
        {pts.map(p => (
          <g key={p.i}
            onMouseEnter={() => setHovered(p.i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor:'pointer' }}>
            <circle cx={p.x} cy={p.y} r={hovered===p.i?7:4} fill={hovered===p.i?M:C} stroke="#06060c" strokeWidth={2} />
            {hovered === p.i && (
              <g>
                <rect x={p.x-60} y={p.y-36} width={120} height={28} rx={6} fill="#0d0d1a" stroke={C} strokeWidth={1} />
                <text x={p.x} y={p.y-26} textAnchor="middle" fontSize={9} fill={C} fontFamily="monospace">
                  {tracks[p.i] ? `${tracks[p.i].n}. ${tracks[p.i].artist}` : `Track ${p.i+1}`}
                </text>
                <text x={p.x} y={p.y-16} textAnchor="middle" fontSize={9} fill="#e8e8f0" fontFamily="monospace">
                  E{p.e}/10
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#3a3a58', fontFamily:'monospace', padding:'0 20px' }}>
        <span>OPENING</span><span>ENERGY JOURNEY</span><span>CLOSE</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function AnalysePage() {
  const { isSignedIn } = useAuth()
  const [rawText,   setRawText]   = useState('')
  const [context,   setContext]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string|null>(null)
  const [report,    setReport]    = useState<Report|null>(null)
  const [tracks,    setTracks]    = useState<{ n:number; artist:string; title:string; bpm?:number; key?:string }[]>([])
  const [exporting,         setExporting]         = useState(false)
  const [includeMixingNotes, setIncludeMixingNotes] = useState(true)
  const [history,   setHistory]   = useState<{ grade:string; track_count:number; context:string; created_at:string }[]>([])
  const [showHistory,   setShowHistory]   = useState(false)
  const [libSets,       setLibSets]       = useState<{id:string;title:string;set_data:{title:string;tracks:{artist:string;title:string;bpm?:number;key?:string;n:number}[];_meta?:Record<string,string>};meta:Record<string,string>}[]>([])
  const [showLibPicker, setShowLibPicker] = useState(false)
  const [loadingLib,    setLoadingLib]    = useState(false)

  async function analyse() {
    if (!rawText.trim()) return
    await runAnalysis(rawText, context)
  }

  async function loadHistory() {
    try {
      const res  = await fetch('/api/analyse/history')
      const data = await res.json()
      if (res.ok) setHistory(data.analyses || [])
    } catch {}
    setShowHistory(true)
  }

  async function loadLibSets() {
    setLoadingLib(true)
    try {
      const res  = await fetch('/api/library')
      const data = await res.json()
      if (res.ok) setLibSets(data.sets || [])
    } catch {}
    finally { setLoadingLib(false); setShowLibPicker(true) }
  }

  // Shared core analysis function — called by both the paste flow and library flow
  async function runAnalysis(text: string, ctx: string) {
    setReport(null)
    setError(null)
    setLoading(true)
    try {
      const res  = await fetch('/api/analyse', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text, context: ctx }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Analysis failed. Please try again.'); return }
      setTracks(data.tracks || [])
      setReport(data.report)
    } catch { setError('Network error. Please try again.') }
    finally   { setLoading(false) }
  }

  // Called from library picker — takes full set object, no second fetch needed
  function analyseFromLibrary(s: typeof libSets[0]) {
    setShowLibPicker(false)
    setShowHistory(false)

    const tracks = s.set_data?.tracks || []
    if (!tracks.length) { setError('This set has no tracks to analyse.'); return }

    const lines = tracks
      .map((t: {n:number;artist:string;title:string;bpm?:number;key?:string}) =>
        `${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title}${t.bpm ? ` [${t.bpm} BPM]` : ''}${t.key ? ` [${t.key}]` : ''}`)
      .join('\n')

    const ctx = [
      s.meta?.genre    || s.set_data?._meta?.genre,
      s.meta?.crowd    || s.set_data?._meta?.crowd,
      s.meta?.arc      || s.set_data?._meta?.arc,
    ].filter(Boolean).join(' / ')

    setRawText(lines)
    setContext(ctx || '')
    runAnalysis(lines, ctx || '')
  }

  async function exportPDF() {
    if (!report) return
    setExporting(true)
    try {
      const res  = await fetch('/api/analyse/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, tracks, includeMixingNotes }),
      })
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), {
        href:     url,
        download: `setforge-analysis-${new Date().toISOString().slice(0,10)}.txt`,
      })
      a.click()
    } catch {}
    finally { setExporting(false) }
  }

  const gc = report ? gradeConfig(report.grade) : null

  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif", overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap');
        .sf-mono    { font-family:'JetBrains Mono',monospace; }
        .sf-display { font-family:'Bebas Neue',sans-serif; }
        .btn-cta  { background:linear-gradient(110deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:box-shadow .2s,transform .15s; }
        .btn-cta:hover  { box-shadow:0 0 0 3px ${C}44,0 8px 40px ${C}44,0 8px 40px ${M}28; transform:translateY(-1px); }
        .btn-ghost { background:transparent; border:1.5px solid #2a2a42; color:#e8e8f0; cursor:pointer; font-family:'Inter',sans-serif; transition:border-color .2s,color .2s; }
        .btn-ghost:hover { border-color:${C}; color:${C}; }
        textarea { resize:vertical; }
        @keyframes rise { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .rise { animation:rise .5s ease backwards; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#1f1f33; border-radius:2px; }
      `}</style>

      {/* bg grid */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C}06 1px,transparent 1px),linear-gradient(90deg,${C}06 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 0%,black,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)', width:700, height:500, background:`radial-gradient(circle,${M}12,transparent 65%)`, filter:'blur(80px)', pointerEvents:'none', zIndex:0 }} />

      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(16px)', background:'rgba(6,6,12,.88)', padding:'0 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <Link href="/" style={{ textDecoration:'none' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>
                <span style={{ color:C }}>SET</span><span style={{ color:M }}>FORGE</span>
              </div>
            </Link>
            <div style={{ fontSize:12, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>/ ANALYSER</div>
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            {isSignedIn && (
              <Link href="/app?tab=library" style={{ textDecoration:'none' }}>
                <button className="btn-ghost" style={{ padding:'7px 16px', borderRadius:8, fontSize:13 }}>◈ My Library</button>
              </Link>
            )}
            <Link href="/app" style={{ textDecoration:'none' }}>
              <button className="btn-ghost" style={{ padding:'7px 16px', borderRadius:8, fontSize:13 }}>⚡ Forge a set</button>
            </Link>
            <UserButton />
          </div>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:1, maxWidth:900, margin:'0 auto', padding:'48px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ fontSize:11, color:M, fontFamily:'JetBrains Mono,monospace', letterSpacing:3, marginBottom:12 }}>SET ANALYSER</div>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(42px,7vw,80px)', margin:'0 0 16px', letterSpacing:2, lineHeight:1 }}>
            <span style={{ color:C }}>WHAT DOES</span><br />
            <span style={{ color:'#e8e8f0' }}>YOUR SET SAY?</span>
          </h1>
          <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:520, margin:'0 auto', lineHeight:1.7 }}>
            Paste any tracklist — Serato history, a text file, or just type the tracks — and get a full AI breakdown of your energy flow, harmonic mixing, and what to improve.
          </p>
        </div>

        {/* Input panel */}
        {!report && (
          <div className="rise" style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:18, padding:28 }}>
            <div style={{ fontSize:11, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:10 }}>
              PASTE YOUR TRACKLIST — any format works
            </div>
            <div style={{ fontSize:11, color:'#3a3a58', marginBottom:12, lineHeight:1.6 }}>
              Works with: numbered lists, "Artist - Title" format, Serato copy-paste, Rekordbox exports, or just track names one per line. BPM and key are optional but improve the analysis.
            </div>

            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`01. Fisher — Losing It [125 BPM] [7A]
02. Chris Lake — Turn Off The Lights [126 BPM]
03. Dom Dolla — San Frandisco
04. John Summit — Deep End [126 BPM] [9A]
05. Eli Brown — Believe [127 BPM]
...`}
              style={{ width:'100%', minHeight:220, background:'#06060c', border:'1px solid #1f1f33', color:'#e8e8f0', fontFamily:'JetBrains Mono,monospace', fontSize:12, padding:'14px 16px', borderRadius:10, outline:'none', lineHeight:1.7, transition:'border-color .2s' }}
              onFocus={e => { e.target.style.borderColor = C }}
              onBlur={e  => { e.target.style.borderColor = '#1f1f33' }}
            />

            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:11, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:6 }}>CONTEXT <span style={{ color:'#3a3a58' }}>— optional but helpful</span></div>
              <input
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="e.g. 4-hour closing set, warehouse party, peak time Tech House, 130 BPM techno…"
                style={{ width:'100%', background:'#06060c', border:'1px solid #1f1f33', color:'#e8e8f0', fontFamily:'JetBrains Mono,monospace', fontSize:12, padding:'10px 14px', borderRadius:8, outline:'none', transition:'border-color .2s' }}
                onFocus={e => { e.target.style.borderColor = C }}
                onBlur={e  => { e.target.style.borderColor = '#1f1f33' }}
              />
            </div>

            <div style={{ display:'flex', gap:10, marginTop:18, flexWrap:'wrap', alignItems:'center' }}>
              <button
                onClick={analyse}
                disabled={loading || !rawText.trim()}
                className="btn-cta"
                style={{ padding:'13px 32px', borderRadius:10, fontSize:15, opacity: loading || !rawText.trim() ? .6 : 1 }}
              >
                {loading ? 'Analysing your set…' : '🔍 Analyse My Set'}
              </button>
              <button
                onClick={showHistory ? () => setShowHistory(false) : loadHistory}
                className="btn-ghost"
                style={{ padding:'11px 20px', borderRadius:10, fontSize:13 }}
              >
                {showHistory ? 'Hide history' : '📋 Past analyses'}
              </button>
              <button
                onClick={showLibPicker ? () => setShowLibPicker(false) : loadLibSets}
                className="btn-ghost"
                style={{ padding:'11px 20px', borderRadius:10, fontSize:13 }}
              >
                {loadingLib ? 'Loading…' : showLibPicker ? 'Hide library' : '◈ From my library'}
              </button>
            </div>

            {loading && (
              <div style={{ marginTop:20, fontSize:11, color:C, fontFamily:'JetBrains Mono,monospace', animation:'pulse 1.2s infinite' }}>
                Parsing tracks → scoring energy flow → analysing harmonic progression → generating report…
              </div>
            )}

            {error && (
              <div style={{ marginTop:14, padding:12, border:`1px solid ${M}`, borderRadius:8, color:M, fontSize:13 }}>
                {error}
              </div>
            )}

            {/* Library picker panel */}
            {showLibPicker && (
              <div style={{ marginTop:20, borderTop:'1px solid #1a1a2e', paddingTop:16 }}>
                <div style={{ fontSize:11, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:12 }}>YOUR SAVED SETS</div>
                {libSets.length === 0 ? (
                  <div style={{ fontSize:13, color:'#4a4a66' }}>No saved sets yet. Forge and save a set first.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto' }}>
                    {libSets.map(s => (
                      <div key={s.id}
                        onClick={() => analyseFromLibrary(s)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#06060c', border:'1px solid #1a1a2e', borderRadius:8, padding:'10px 14px', cursor:'pointer', transition:'.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = C}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#1a1a2e'}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#e8e8f0', marginBottom:2 }}>{s.title}</div>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            {[s.meta?.genre, s.meta?.crowd].filter(Boolean).map(tag => (
                              <span key={String(tag)} style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'1px 7px' }}>{String(tag)}</span>
                            ))}
                            {s.set_data?.tracks?.length && <span style={{ fontSize:10, color:'#4a4a66' }}>{s.set_data.tracks.length} tracks</span>}
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:C, flexShrink:0, marginLeft:12 }}>Analyse →</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* History panel */}
            {showHistory && (
              <div style={{ marginTop:20, borderTop:'1px solid #1a1a2e', paddingTop:16 }}>
                <div style={{ fontSize:11, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:12 }}>PAST ANALYSES</div>
                {history.length === 0 ? (
                  <div style={{ fontSize:13, color:'#4a4a66' }}>No past analyses yet.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {history.map((h, i) => {
                      const gc = gradeConfig(h.grade)
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background:'#06060c', border:'1px solid #1a1a2e', borderRadius:8, padding:'10px 14px' }}>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:gc.color, minWidth:32 }}>{h.grade}</div>
                          <div>
                            <div style={{ fontSize:12, color:'#c8c8e0' }}>{h.track_count} tracks{h.context ? ` · ${h.context}` : ''}</div>
                            <div style={{ fontSize:10, color:'#4a4a66' }}>{new Date(h.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── REPORT ── */}
        {report && gc && (
          <div className="rise">

            {/* Actions bar */}
            <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
              <button onClick={() => { setReport(null); setTracks([]) }} className="btn-ghost" style={{ padding:'9px 18px', borderRadius:8, fontSize:13 }}>
                ← Analyse another set
              </button>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={() => { setIncludeMixingNotes(true); setTimeout(exportPDF, 0) }} disabled={exporting}
                  className="btn-ghost" style={{ padding:'9px 16px', borderRadius:8, fontSize:12 }}>
                  {exporting && includeMixingNotes ? 'Exporting…' : '↓ Full report'}
                </button>
                <button onClick={() => { setIncludeMixingNotes(false); setTimeout(exportPDF, 0) }} disabled={exporting}
                  className="btn-ghost" style={{ padding:'9px 16px', borderRadius:8, fontSize:12 }}>
                  {exporting && !includeMixingNotes ? 'Exporting…' : '↓ Tracklist only'}
                </button>
              </div>
            </div>

            {/* Grade hero */}
            <div style={{ background:`linear-gradient(135deg,#0d0d1a,#0a0a14)`, border:`1.5px solid ${gc.color}44`, borderRadius:20, padding:'36px 32px', marginBottom:20, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-60, right:-60, width:220, height:220, background:`radial-gradient(circle,${gc.color}14,transparent 70%)`, filter:'blur(30px)', pointerEvents:'none' }} />
              <div style={{ position:'relative', display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:96, lineHeight:1, color:gc.color, filter:`drop-shadow(0 0 20px ${gc.color}88)` }}>{report.grade}</div>
                  <div style={{ fontSize:13, color:gc.color, fontWeight:700, background:gc.bg, borderRadius:999, padding:'3px 14px', marginTop:4 }}>{gc.label}</div>
                </div>
                <div style={{ flex:1, minWidth:240 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#e8e8f0', marginBottom:8, lineHeight:1.4 }}>{report.overview}</div>
                  <div style={{ fontSize:14, color:'#9a9ab8', fontStyle:'italic' }}>"{report.gradeReason}"</div>
                </div>
              </div>
            </div>

            {/* Score rings */}
            <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:'24px 20px', marginBottom:20 }}>
              <div style={{ fontSize:11, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:20 }}>SCORES</div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap', justifyContent:'space-around' }}>
                {Object.values(report.scores).map((s, i) => <ScoreRing key={i} {...s} />)}
              </div>
            </div>

            {/* Energy curve */}
            {report.energyCurve?.length > 0 && (
              <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:'20px', marginBottom:20 }}>
                <div style={{ fontSize:11, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:14 }}>ENERGY JOURNEY</div>
                <EnergyCurveChart curve={report.energyCurve} tracks={tracks} />
              </div>
            )}

            {/* Peak + weakest side by side */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16, marginBottom:20 }}>
              {/* Peak moment */}
              <div style={{ background:'#0a0a14', border:`1px solid #4ade8033`, borderRadius:14, padding:22 }}>
                <div style={{ fontSize:9, color:'#4ade80', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:10, fontWeight:700 }}>🔥 PEAK MOMENT</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:'#4ade80', marginBottom:4 }}>
                  Track {report.peakMoment.trackN}
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:'#e8e8f0', marginBottom:2 }}>{report.peakMoment.title}</div>
                <div style={{ fontSize:12, color:'#8a8aa8', marginBottom:10 }}>{report.peakMoment.artist}</div>
                <div style={{ fontSize:13, color:'#9a9ab8', lineHeight:1.6 }}>{report.peakMoment.reason}</div>
              </div>

              {/* Weakest transition */}
              <div style={{ background:'#0a0a14', border:`1px solid ${M}33`, borderRadius:14, padding:22 }}>
                <div style={{ fontSize:9, color:M, fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:10, fontWeight:700 }}>⚠️ HARDEST TRANSITION</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:M, marginBottom:4 }}>
                  Track {report.weakestTransition.fromN} → {report.weakestTransition.toN}
                </div>
                <div style={{ fontSize:13, color:'#9a9ab8', lineHeight:1.6, marginBottom:10 }}>{report.weakestTransition.reason}</div>
                <div style={{ background:`${C}0e`, border:`1px solid ${C}33`, borderRadius:8, padding:'8px 12px' }}>
                  <div style={{ fontSize:9, color:C, fontFamily:'JetBrains Mono,monospace', letterSpacing:1, marginBottom:4, fontWeight:700 }}>THE FIX</div>
                  <div style={{ fontSize:12, color:'#c8c8e0', lineHeight:1.6 }}>{report.weakestTransition.fix}</div>
                </div>
              </div>
            </div>

            {/* Strengths + Improvements */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16, marginBottom:20 }}>
              {/* Strengths */}
              <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:14, padding:22 }}>
                <div style={{ fontSize:9, color:'#4ade80', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:14, fontWeight:700 }}>✓ STRENGTHS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {report.strengths.map((s, i) => (
                    <div key={i} style={{ display:'flex', gap:10, fontSize:14, color:'#c8c8e0', lineHeight:1.5 }}>
                      <span style={{ color:'#4ade80', flexShrink:0, fontWeight:700 }}>✓</span>{s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Improvements */}
              <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:14, padding:22 }}>
                <div style={{ fontSize:9, color:'#f59e0b', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:14, fontWeight:700 }}>↑ IMPROVEMENTS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {report.improvements.map((imp, i) => (
                    <div key={i}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#e8e8f0', marginBottom:3 }}>{imp.title}</div>
                      <div style={{ fontSize:13, color:'#9a9ab8', lineHeight:1.6 }}>{imp.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Track notes */}
            {report.trackNotes?.length > 0 && (
              <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:14, padding:22, marginBottom:20 }}>
                <div style={{ fontSize:9, color:C, fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:14, fontWeight:700 }}>TRACK-BY-TRACK NOTES</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {report.trackNotes.map(tn => {
                    const t = tracks.find(tr => tr.n === tn.n)
                    return (
                      <div key={tn.n} style={{ display:'grid', gridTemplateColumns:'32px 1fr', gap:10, alignItems:'start', padding:'8px 10px', background:'#06060c', borderRadius:8, border:'1px solid #16162a' }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:M }}>{String(tn.n).padStart(2,'0')}</div>
                        <div>
                          {t && <div style={{ fontSize:12, fontWeight:600, color:'#e8e8f0', marginBottom:2 }}>{t.artist} — {t.title}</div>}
                          <div style={{ fontSize:12, color:'#6a6a8a', lineHeight:1.5 }}>{tn.note}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Verdict */}
            <div style={{ background:`linear-gradient(135deg,${M}0e,${C}0e)`, border:`1px solid ${C}33`, borderRadius:14, padding:'20px 24px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:C, fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:10, fontWeight:700 }}>VERDICT</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#e8e8f0', lineHeight:1.5 }}>"{report.verdict}"</div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
