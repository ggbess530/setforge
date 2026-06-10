// ▸ Create folder: app/app/
// ▸ Place at:      app/app/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

// ── constants ────────────────────────────────────────────────
const GENRE_GROUPS: Record<string, string[]> = {
  'House':          ['House','Tech House','Deep House','Progressive House','Afro House','Melodic House','Soulful House','Tribal House','Bass House','Future House'],
  'Techno':         ['Techno','Melodic Techno','Peak Time Techno','Minimal / Deep Tech','Hard Techno','Industrial Techno','Dub Techno'],
  'Bass & Breaks':  ['Drum & Bass','Dubstep','UK Garage / UKG','Breakbeat','Jungle','Bassline','Future Bass'],
  'Trance':         ['Trance','Progressive Trance','Psytrance','Uplifting Trance','Hard Trance'],
  'Urban / Hip Hop':['Hip Hop','Trap','R&B','Afrobeats','Amapiano','Reggaeton','Dancehall'],
  'Classic / Groove':['Disco / Funk','Nu-Disco','Funky House','Acid House','Old School / 90s','Italo Disco'],
  'Open Format':    ['Open Format / Multi-Genre','Top 40 / Pop','Latin','Reggae / Dub'],
}
const CROWDS  = ['Club Peak Hour','Warm-Up Set','Festival Main Stage','Wedding','House Party','Rooftop / Lounge']
const ARCS    = ['Slow Build','Peak Time Energy','Cool Down','Wave (up & down)']
const CAM_HUES = [0,30,60,90,120,150,180,210,240,270,300,330]
const C = '#00f0ff'
const M = '#ff1e8a'

// ── types ─────────────────────────────────────────────────────
type Track   = { n:number; artist:string; title:string; bpm:number; key:string; energy:number; transition:string }
type SetData = { title:string; summary:string; tracks:Track[]; _meta?:Record<string,string> }
type LibItem = { id:string; title:string; meta:Record<string,string|number>; created_at:string }

// ── main component ────────────────────────────────────────────
export default function AppPage() {

  // form
  const [genre,     setGenre]     = useState('Tech House')
  const [crowd,     setCrowd]     = useState('Club Peak Hour')
  const [arc,       setArc]       = useState('Slow Build')
  const [vibe,      setVibe]      = useState('')
  const [refArtist, setRefArtist] = useState('')
  const [mode,      setMode]      = useState<'time'|'count'>('time')
  const [minutes,   setMinutes]   = useState(60)
  const [count,     setCount]     = useState(12)
  const [bpmLow,    setBpmLow]    = useState(120)
  const [bpmHigh,   setBpmHigh]   = useState(128)
  const [keyMatch,  setKeyMatch]  = useState(true)

  // generator
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string|null>(null)
  const [set,      setSet]      = useState<SetData|null>(null)
  const [swapping, setSwapping] = useState<number|null>(null)
  const [quota, setQuota] = useState<{
    tier: string;
    remaining: string | number;
    trial?: { active: boolean; daysLeft: number } | null
  } | null>(null)

  // library
  const [view,       setView]       = useState<'forge'|'library'>('forge')
  const [library,    setLibrary]    = useState<LibItem[]>([])
  const [libLoaded,  setLibLoaded]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [libLoading, setLibLoading] = useState(false)
  const [deleteConf, setDeleteConf] = useState<string|null>(null)
  const [sharingId,  setSharingId]  = useState<string|null>(null)  // id being shared
  const [copiedId,   setCopiedId]   = useState<string|null>(null)
  const [renamingId, setRenamingId] = useState<string|null>(null)
  const [renameVal,  setRenameVal]  = useState('')
  const [locked,  setLocked]  = useState<Set<number>>(new Set())  // indices of locked tracks
  const [copied,  setCopied]  = useState(false)                    // tracklist copied flash

  const resultRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  // load library index on mount
  useEffect(() => { loadLibrary() }, [])

  // scroll to results after generation
  useEffect(() => {
    if (set && resultRef.current) resultRef.current.scrollIntoView({ behavior:'smooth', block:'start' })
  }, [set])

  // focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

  // ── generate ──────────────────────────────────────────────
   async function generate(keepLocks = false) {
    setLoading(true); setError(null)
 
    // Collect locked track data BEFORE clearing the set
    const lockedTracks = keepLocks && set
      ? [...locked].map(i => set.tracks[i]).filter(Boolean)
      : []
 
    if (!keepLocks) setLocked(new Set())
    setSet(null)
 
    try {
      const res = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre, crowd, arc, vibe, refArtist, mode, minutes, count, bpmLow, bpmHigh, keyMatch, lockedTracks }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Generation failed.'); return }
      setSet({ ...data.set, _meta: { genre, crowd, arc, vibe, refArtist } })
      if (data.quota) setQuota(data.quota)
      // Re-lock the same positions if we reforged with locks
      if (keepLocks && lockedTracks.length > 0) {
        const newLocked = new Set<number>()
        lockedTracks.forEach(lt => {
          const idx = data.set.tracks.findIndex((t: { artist:string; title:string }) => t.artist === lt.artist && t.title === lt.title)
          if (idx >= 0) newLocked.add(idx)
        })
        setLocked(newLocked)
      }
    } catch { setError('Network error. Please try again.') }
    finally   { setLoading(false) }
  }

  // ── hot-swap ──────────────────────────────────────────────
  async function swapTrack(index: number) {
    if (!set) return
    setSwapping(index); setError(null)
    const target = set.tracks[index]
    try {
      const res = await fetch('/api/swap', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          prev:     set.tracks[index - 1] ?? null,
          next:     set.tracks[index + 1] ?? null,
          existing: set.tracks,
          genre, crowd, arc, vibe, refArtist, bpmLow, bpmHigh, keyMatch,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Swap failed.'); return }
      setSet(s => {
        if (!s) return s
        const tracks = [...s.tracks]
        tracks[index] = { ...data.track, n: target.n }
        return { ...s, tracks }
      })
    } catch { setError('Network error. Please try again.') }
    finally   { setSwapping(null) }
  }

  // ── save ──────────────────────────────────────────────────
  async function saveSet() {
    if (!set || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/library', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:   set.title,
          setData: set,
          meta: {
            genre:      set._meta?.genre      || genre,
            crowd:      set._meta?.crowd      || crowd,
            arc:        set._meta?.arc        || arc,
            vibe:       set._meta?.vibe       || vibe,
            refArtist:  set._meta?.refArtist  || refArtist,
            trackCount: set.tracks.length,
            savedAt:    Date.now(),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Save failed.'); return }
      setLibrary(prev => [data.set, ...prev])
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch { setError('Network error. Please try again.') }
    finally   { setSaving(false) }
  }

  // ── library ───────────────────────────────────────────────
  async function loadLibrary() {
    try {
      const res  = await fetch('/api/library')
      const data = await res.json()
      if (res.ok) setLibrary(data.sets || [])
    } catch { /* non-fatal */ }
    finally { setLibLoaded(true) }
  }



  async function loadSet(id: string) {
    setLibLoading(true)
    try {
      const res  = await fetch(`/api/library/item?id=${id}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Load failed.'); return }
      const saved: SetData = data.set.set_data
      setSet(saved)
      if (saved._meta) {
        setGenre(saved._meta.genre || genre)
        setCrowd(saved._meta.crowd || crowd)
        setArc(saved._meta.arc     || arc)
        setVibe(saved._meta.vibe   || '')
        setRefArtist(saved._meta.refArtist || '')
      }
      setView('forge')
    } catch { setError('Network error. Please try again.') }
    finally   { setLibLoading(false) }
  }
  async function shareSet(setId: string) {
    setSharingId(setId)
    try {
      const res  = await fetch('/api/share', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Share failed.'); return }
 
      const url = `${window.location.origin}/s?id=${data.shareId}`
      await navigator.clipboard.writeText(url)
      setCopiedId(setId)
      setTimeout(() => setCopiedId(null), 2500)
    } catch { setError('Failed to copy share link.') }
    finally   { setSharingId(null) }
  }

  async function deleteSet(id: string) {
    await fetch(`/api/library/item?id=${id}`, { method: 'DELETE' })
    setLibrary(prev => prev.filter(s => s.id !== id))
    setDeleteConf(null)
  }

async function commitRename(id: string) {
  const trimmed = renameVal.trim()
  if (!trimmed) { setRenamingId(null); setRenameVal(''); return }
  try {
    const res = await fetch(`/api/library/item?id=${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (res.ok) {
      setLibrary(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s))
      if (set?.title && renamingId === id) setSet(s => s ? { ...s, title: trimmed } : s)
    }
  } catch { /* non-fatal */ }
  finally { setRenamingId(null); setRenameVal('') }
}
  // ── export ────────────────────────────────────────────────
  function exportText() {
    if (!set) return
    const lines = [set.title.toUpperCase(), set.summary, '',
      ...set.tracks.map(t => `${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title}  [${t.bpm} BPM · ${t.key} · E${t.energy}]\n     ↳ ${t.transition}`),
      '', 'Generated with SetForge',
    ]
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' })),
      download: `${set.title.replace(/\s+/g,'_')}.txt`,
    })
    a.click()
  }
  function toggleLock(index: number) {
    setLocked(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }
 
  async function copyTracklist() {
    if (!set) return
    const text = set.tracks
      .map(t => `${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title} [${t.bpm} BPM · ${t.key}]`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(`${set.title.toUpperCase()}\n\n${text}\n\nForged with SetForge — setforge.online`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setError('Copy failed — your browser may be blocking clipboard access.') }
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", overflowX:'hidden' }}>
      <style>{`
        
        .sf-glow-c  { text-shadow:0 0 8px ${C},0 0 24px ${C}80; }
        .sf-glow-m  { text-shadow:0 0 8px ${M},0 0 24px ${M}80; }
        .sf-input   { background:#0d0d18; border:1px solid #1f1f33; color:#e8e8f0; font-family:'JetBrains Mono',monospace; font-size:13px; padding:10px 12px; border-radius:8px; width:100%; outline:none; transition:.2s; box-sizing:border-box; }
        .sf-input:focus { border-color:${C}; box-shadow:0 0 0 3px ${C}22; }
        .sf-select  { -webkit-appearance:none; appearance:none; cursor:pointer; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2300f0ff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:34px; }
        .sf-select optgroup { background:#06060c; color:${M}; font-style:normal; font-weight:700; }
        .sf-select option   { background:#0d0d18; color:#e8e8f0; }
        .sf-chip  { cursor:pointer; padding:8px 14px; border-radius:999px; border:1px solid #23233a; background:#0d0d18; font-size:12px; transition:.18s; user-select:none; white-space:nowrap; }
        .sf-chip:hover { border-color:#39395c; }
        .sf-chip.on { border-color:${C}; color:${C}; box-shadow:0 0 12px ${C}33; }
        .sf-nav-tab { cursor:pointer; padding:10px 20px; font-size:11px; letter-spacing:3px; border-bottom:2px solid transparent; transition:.2s; user-select:none; }
        .sf-nav-tab.on { border-color:${C}; color:${C}; }
        .sf-nav-tab:hover:not(.on) { color:#9a9ab8; }
        .sf-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; }
        .sf-btn-primary:hover:enabled { box-shadow:0 0 28px ${C}66,0 0 28px ${M}44; }
        .sf-btn-primary:disabled { opacity:.5; cursor:default; }
        .sf-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; }
        .sf-btn-ghost:hover:enabled { border-color:${C}; color:${C}; }
        .sf-btn-ghost:disabled { opacity:.4; cursor:default; }
        .sf-track:hover { border-color:#23233a!important; }
        .sf-swap:hover:enabled { border-color:${C}!important; color:${C}!important; box-shadow:0 0 12px ${C}33; }
        .sf-lib-card:hover { border-color:#23233a!important; }
        .sf-del-btn  { background:transparent; border:1px solid #23233a; color:#5a5a78; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:11px; padding:5px 10px; border-radius:6px; transition:.18s; }
        .sf-del-btn:hover { border-color:${M}; color:${M}; }
        .sf-rename-btn { background:transparent; border:none; color:#4a4a66; cursor:pointer; font-size:13px; padding:2px 6px; border-radius:4px; transition:.15s; line-height:1; }
        .sf-rename-btn:hover { color:${C}; }
        .sf-scan { background:linear-gradient(180deg,transparent,${C},transparent); animation:pulse 1.1s infinite; }
        .sf-row  { animation:rise .42s ease backwards; }
        .sf-slider { -webkit-appearance:none; appearance:none; width:100%; height:10px; border-radius:999px; background:linear-gradient(90deg, ${M}33, ${C}33); border:1px solid #23233a; outline:none; cursor:pointer; transition:.2s; }
        .sf-slider:hover { border-color:${C}66; box-shadow:0 0 16px ${C}22; }
        .sf-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,${M},${C}); border:2px solid #06060c; box-shadow:0 0 12px ${C}88, 0 0 24px ${M}44; cursor:grab; transition:.15s; }
        .sf-slider::-webkit-slider-thumb:hover { transform:scale(1.15); box-shadow:0 0 18px ${C}cc, 0 0 32px ${M}66; }
        .sf-slider::-webkit-slider-thumb:active { cursor:grabbing; transform:scale(1.05); }
        .sf-slider::-moz-range-thumb { width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,${M},${C}); border:2px solid #06060c; box-shadow:0 0 12px ${C}88, 0 0 24px ${M}44; cursor:grab; }
        .sf-slider::-moz-range-track { height:10px; border-radius:999px; background:linear-gradient(90deg, ${M}33, ${C}33); }
        @keyframes rise  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes spin  { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes flash { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 20px ${C}88} }
      `}</style>

      {/* bg */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C}0a 1px,transparent 1px),linear-gradient(90deg,${C}0a 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 0%,black,transparent 75%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)', width:600, height:400, background:`radial-gradient(circle,${M}22,transparent 70%)`, filter:'blur(40px)', pointerEvents:'none', zIndex:0 }} />

      {/* ── TOP NAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(12px)', background:'#06060ccc', padding:'0 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
          <Link href="/" style={{ textDecoration:'none' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:2 }}>
              <span className="sf-glow-c" style={{ color:C }}>SET</span><span className="sf-glow-m" style={{ color:M }}>FORGE</span>
            </div>
          </Link>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {quota?.trial?.active && (
              <div style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                padding: '5px 12px',
                borderRadius: 999,
                border: `1px solid ${quota.trial.daysLeft <= 2 ? M : quota.trial.daysLeft <= 4 ? '#f59e0b' : C}`,
                color: quota.trial.daysLeft <= 2 ? M : quota.trial.daysLeft <= 4 ? '#f59e0b' : C,
              }}>
                {quota.trial.daysLeft}d left in trial
              </div>
            )}
            {quota && !quota.trial?.active && quota.remaining !== 'unlimited' && (
              <div style={{ fontSize: 11, color: C, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: C }}>{quota.remaining}</span> gens left
              </div>
            )}
            <UserButton />
          </div>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:1, maxWidth:900, margin:'0 auto', padding:'40px 20px 80px' }}>

        {/* ── HEADER ── */}
        <div style={{ textAlign:'center', marginBottom:4 }}>
          <div style={{ fontSize:10, letterSpacing:6, color:M, marginBottom:4 }} className="sf-glow-m">PERSONALIZED SET CREATION</div>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:72, lineHeight:.9, margin:0, letterSpacing:2 }}>
            <span className="sf-glow-c">SET</span><span className="sf-glow-m">FORGE</span>
          </h1>
        </div>

        {/* ── TABS ── */}
        <div style={{ display:'flex', justifyContent:'center', borderBottom:'1px solid #16162a', marginTop:20 }}>
          <div className={`sf-nav-tab ${view==='forge'?'on':''}`} onClick={() => setView('forge')}>⚡ FORGE</div>
          <div className={`sf-nav-tab ${view==='library'?'on':''}`} onClick={() => { setView('library'); if (!libLoaded) loadLibrary() }}>
            ◈ LIBRARY{library.length > 0 && <span style={{ marginLeft:6, background:M, color:'#06060c', borderRadius:999, fontSize:9, padding:'1px 6px', fontWeight:700 }}>{library.length}</span>}
          </div>
        </div>

        {/* ══════ FORGE VIEW ══════ */}
        {view === 'forge' && (<>
          <div style={{ background:'#0a0a14cc', border:'1px solid #1a1a2e', borderRadius:16, padding:24, marginTop:24, backdropFilter:'blur(8px)' }}>

            <SFLabel>GENRE</SFLabel>
            <div style={{ marginBottom:20 }}>
              <select className="sf-input sf-select" value={genre} onChange={e => setGenre(e.target.value)}>
                {Object.entries(GENRE_GROUPS).map(([grp,items]) => (
                  <optgroup key={grp} label={grp}>{items.map(g => <option key={g} value={g}>{g}</option>)}</optgroup>
                ))}
              </select>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
              <div><SFLabel>CROWD / CONTEXT</SFLabel><select className="sf-input sf-select" value={crowd} onChange={e => setCrowd(e.target.value)}>{CROWDS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><SFLabel>ENERGY ARC</SFLabel><select className="sf-input sf-select" value={arc} onChange={e => setArc(e.target.value)}>{ARCS.map(a => <option key={a}>{a}</option>)}</select></div>
            </div>

            <div style={{ marginBottom:20 }}>
              <SFLabel>VIBE / MOOD <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel>
              <input className="sf-input" value={vibe} onChange={e => setVibe(e.target.value)} placeholder="e.g. dark & hypnotic, summery rooftop, raw & driving…" />
            </div>
            <div style={{ marginBottom:20 }}>
              <SFLabel>REFERENCE ARTISTS <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel>
              <input className="sf-input" value={refArtist} onChange={e => setRefArtist(e.target.value)} placeholder="e.g. Boris Brejcha, Tale Of Us, Charlotte de Witte…" />
            </div>

            <SFLabel>SET LENGTH</SFLabel>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <div className={`sf-chip ${mode==='time'?'on':''}`} onClick={() => setMode('time')}>By Time</div>
              <div className={`sf-chip ${mode==='count'?'on':''}`} onClick={() => setMode('count')}>By Track Count</div>
            </div>
              <div style={{ marginBottom:20, padding:'16px 18px', background:'#06060c', border:'1px solid #1a1a2e', borderRadius:12 }}>
              {mode === 'time' ? (<>
                <input type="range" min={15} max={240} step={15} value={minutes} onChange={e => setMinutes(+e.target.value)} className="sf-slider" />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:12 }}>
                  <div>
                    <span className="sf-glow-c" style={{ fontSize:26, color:C, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1 }}>{minutes} MIN</span>
                    <span style={{ fontSize:12, color:'#6a6a8a', marginLeft:10 }}>~{Math.round(minutes/4.5)} tracks</span>
                  </div>
                  <span style={{ fontSize:10, color:'#4a4a66', letterSpacing:1 }}>15 MIN – 4 HR</span>
                </div>
              </>) : (<>
                <input type="range" min={4} max={50} value={count} onChange={e => setCount(+e.target.value)} className="sf-slider" />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:12 }}>
                  <span className="sf-glow-c" style={{ fontSize:26, color:C, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1 }}>{count} TRACKS</span>
                  <span style={{ fontSize:10, color:'#4a4a66', letterSpacing:1 }}>4 – 50</span>
                </div>
              </>)}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:20, alignItems:'end' }}>
              <div><SFLabel>BPM LOW</SFLabel><input className="sf-input" type="number" value={bpmLow} onChange={e => setBpmLow(+e.target.value)} /></div>
              <div><SFLabel>BPM HIGH</SFLabel><input className="sf-input" type="number" value={bpmHigh} onChange={e => setBpmHigh(+e.target.value)} /></div>
              <div className={`sf-chip ${keyMatch?'on':''}`} onClick={() => setKeyMatch(!keyMatch)} style={{ height:40, display:'flex', alignItems:'center' }}>
                ♪ Harmonic {keyMatch?'ON':'OFF'}
              </div>
            </div>

            <button className="sf-btn-primary" onClick={() => generate(false)} disabled={loading} style={{ width:'100%', marginTop:28, padding:16, borderRadius:10, fontSize:15, letterSpacing:2, transition:'.2s' }}>
              {loading ? 'FORGING SET…' : '⚡ FORGE SET'}
            </button>
          </div>

          {error && (
            <div style={{ marginTop:16, padding:14, border:`1px solid ${M}`, borderRadius:10, color:M, fontSize:13 }}>
              {error}
              {error.includes('subscription') && (
                <Link href="/#pricing" style={{ color:C, marginLeft:8, textDecoration:'underline' }}>View plans →</Link>
              )}
            </div>
          )}

          {loading && (
            <div style={{ marginTop:32, textAlign:'center' }}>
              <div className="sf-scan" style={{ height:2, width:'100%', borderRadius:2 }} />
              <div style={{ marginTop:16, fontSize:11, letterSpacing:3, color:'#6a6a8a', animation:'pulse 1.2s infinite' }}>BEAT-MATCHING · KEY-SORTING · SHAPING ENERGY</div>
            </div>
          )}

          {/* ── RESULTS ── */}
          {set && (
            <div ref={resultRef} style={{ marginTop:40 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:38, margin:0, letterSpacing:1 }} className="sf-glow-c">{set.title}</h2>
                  <div style={{ fontSize:12, color:'#9a9ab8', maxWidth:480, lineHeight:1.5 }}>{set.summary}</div>
                  <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                    {[set._meta?.genre||genre, set._meta?.crowd||crowd, set._meta?.arc||arc].map(tag => tag && (
                      <span key={tag} style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 8px' }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button onClick={saveSet} disabled={saving} className="sf-btn-ghost" style={{ padding:'10px 16px', borderRadius:8, fontSize:12, animation:savedFlash?'flash .6s ease':'none', color:savedFlash?C:undefined, borderColor:savedFlash?C:undefined }}>
                    {saving?'SAVING…':savedFlash?'✓ SAVED':'◈ SAVE TO LIBRARY'}
                  </button>
                  <button onClick={exportText} className="sf-btn-ghost" style={{ padding:'10px 16px', borderRadius:8, fontSize:12 }}>↓ EXPORT .TXT</button>
                   <button onClick={copyTracklist} className="sf-btn-ghost" style={{ padding:'10px 16px', borderRadius:8, fontSize:12, color: copied ? '#00f0ff' : undefined, borderColor: copied ? '#00f0ff' : undefined }}>
                    {copied ? '✓ COPIED' : '⧉ COPY LIST'}
                  </button>
                  {locked.size > 0 && (
                    <button onClick={() => generate(true)} disabled={loading} className="sf-btn-ghost" style={{ padding:'10px 16px', borderRadius:8, fontSize:12, color:'#f59e0b', borderColor:'#f59e0b' }}>
                      ↻ REFORGE ({locked.size} locked)
                    </button>
                  )}
                </div>
              </div>

              <EnergyBar tracks={set.tracks} />

              {/* camelot + key sequence */}
              <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'auto 1fr', gap:20, alignItems:'start' }}>
                <CamelotWheel tracks={set.tracks} />
                <div style={{ display:'flex', flexDirection:'column', gap:6, paddingTop:28 }}>
                  <div style={{ fontSize:10, letterSpacing:2, color:'#6a6a8a', marginBottom:4 }}>KEY SEQUENCE</div>
                  {set.tracks.map((t,i) => {
                    const m = (t.key||'').toUpperCase().match(/^(\d+)([AB])$/)
                    const hue = m ? CAM_HUES[parseInt(m[1])-1] : null
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
                        <span style={{ color:M, fontFamily:"'Bebas Neue',sans-serif", fontSize:14, minWidth:24 }}>{String(t.n).padStart(2,'0')}</span>
                        {hue !== null && <span style={{ width:8, height:8, borderRadius:'50%', background:`hsl(${hue},85%,58%)`, flexShrink:0, boxShadow:`0 0 6px hsl(${hue},85%,58%)` }} />}
                        <span style={{ color:'#e8e8f0', fontWeight:700, minWidth:32 }}>{t.key}</span>
                        <span style={{ color:'#6a6a8a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.artist} — {t.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* track list */}
              <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8 }}>
                {set.tracks.map((t,i) => (
                  <div key={`${t.n}-${t.title}`} className="sf-row sf-track" style={{ animationDelay:`${i*0.03}s`, display:'grid', gridTemplateColumns:'36px 1fr auto auto auto', gap:12, alignItems:'center', background:'#0a0a14', border: locked.has(i) ? '1px solid #f59e0b55' : '1px solid #16162a', borderRadius:10, padding:'12px 16px', opacity:swapping===i?0.45:1, transition:'.2s' }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:M }} className="sf-glow-m">{String(t.n).padStart(2,'0')}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700 }}>{t.title}</div>
                      <div style={{ fontSize:12, color:'#8a8aa8' }}>{t.artist}</div>
                      <div style={{ fontSize:11, color:'#5a5a78', marginTop:3 }}>↳ {t.transition}</div>
                    </div>
                    <div style={{ textAlign:'right', fontSize:12, lineHeight:1.7 }}>
                      <div style={{ color:C }}>{t.bpm} <span style={{ color:'#5a5a78' }}>BPM</span></div>
                      <div>{t.key}</div>
                      <div style={{ color:'#5a5a78' }}>E{t.energy}</div>
                    </div>
                     <button
                      onClick={() => toggleLock(i)}
                      title={locked.has(i) ? 'Unlock track' : 'Lock track — survives reforge'}
                      style={{
                        background:'transparent',
                        border:`1px solid ${locked.has(i) ? '#f59e0b' : '#23233a'}`,
                        color: locked.has(i) ? '#f59e0b' : '#5a5a78',
                        width:36, height:36, borderRadius:8, cursor:'pointer',
                        fontSize:15, display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'.18s', flexShrink:0,
                        boxShadow: locked.has(i) ? '0 0 10px #f59e0b44' : 'none',
                      }}
                    >
                      {locked.has(i) ? '🔒' : '🔓'}
                    </button>
                    <button className="sf-swap" onClick={() => swapTrack(i)} disabled={swapping!==null} title="Swap for a fresh pick" style={{ background:'transparent', border:'1px solid #23233a', color:swapping===i?M:'#8a8aa8', width:36, height:36, borderRadius:8, cursor:swapping!==null?'default':'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0 }}>
                      <span style={swapping===i?{animation:'spin .8s linear infinite',display:'inline-block'}:{}}>⟳</span>
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16, fontSize:11, color:'#4a4a66', textAlign:'center' }}>
                AI-curated blueprints — verify BPM & key in your library before performing.
              </div>
            </div>
          )}
        </>)}

        {/* ══════ LIBRARY VIEW ══════ */}
        {view === 'library' && (
          <div style={{ marginTop:24 }}>
            {!libLoaded ? (
              <div style={{ textAlign:'center', color:'#6a6a8a', padding:60, fontSize:12, letterSpacing:2, animation:'pulse 1.2s infinite' }}>LOADING LIBRARY…</div>
            ) : library.length === 0 ? (
              <div style={{ textAlign:'center', padding:80 }}>
                <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>◈</div>
                <div style={{ color:'#6a6a8a', fontSize:13 }}>No saved sets yet.</div>
                <div style={{ color:'#4a4a66', fontSize:12, marginTop:6 }}>Forge a set and hit <span style={{ color:C }}>Save to Library</span> to store it here.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {library.map((item,i) => (
                  <div key={item.id} className="sf-row sf-lib-card" style={{ animationDelay:`${i*0.04}s`, background:'#0a0a14', border:'1px solid #16162a', borderRadius:12, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                    <div style={{ flex:1, minWidth:180 }}>
                      {renamingId === item.id ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <input ref={renameRef} className="sf-input" value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => { if (e.key==='Enter') commitRename(item.id); if (e.key==='Escape') { setRenamingId(null); setRenameVal('') } }} style={{ fontSize:15, padding:'6px 10px', fontFamily:"'Bebas Neue',sans-serif", maxWidth:260 }} />
                          <button onClick={() => commitRename(item.id)} style={{ background:C, color:'#06060c', border:'none', padding:'6px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>SAVE</button>
                          <button className="sf-del-btn" onClick={() => { setRenamingId(null); setRenameVal('') }}>CANCEL</button>
                        </div>
                      ) : (
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:1 }} className="sf-glow-c">{item.title}</div>
                          <button className="sf-rename-btn" onClick={() => { setRenamingId(item.id); setRenameVal(item.title) }} title="Rename">✏</button>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                        {[item.meta?.genre, item.meta?.crowd, item.meta?.arc].map(tag => tag && (
                          <span key={String(tag)} style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 8px' }}>{String(tag)}</span>
                        ))}
                      </div>
                      {item.meta?.vibe      && <div style={{ fontSize:11, color:'#5a5a78', fontStyle:'italic' }}>"{item.meta.vibe}"</div>}
                      {item.meta?.refArtist && <div style={{ fontSize:11, color:'#5a5a78' }}>Ref: {item.meta.refArtist}</div>}
                      <div style={{ fontSize:11, color:'#4a4a66', marginTop:4 }}>
                        {item.meta?.trackCount && `${item.meta.trackCount} tracks · `}
                        {new Date(item.meta?.savedAt ? Number(item.meta.savedAt) : item.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </div>
                    </div>
                    
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                      {deleteConf === item.id ? (
                        <>
                        
                          <span style={{ fontSize:11, color:M }}>Delete?</span>
                          <button onClick={() => deleteSet(item.id)} style={{ background:M, color:'#06060c', border:'none', padding:'6px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>YES</button>
                          <button className="sf-del-btn" onClick={() => setDeleteConf(null)}>NO</button>
                        </>
                      ) : (
                        <button className="sf-del-btn" onClick={() => { setDeleteConf(item.id); setRenamingId(null); setRenameVal('') }}>✕ DELETE</button>
                      )}
                      <button onClick={() => loadSet(item.id)} disabled={libLoading} className="sf-btn-ghost" style={{ padding:'8px 16px', borderRadius:8, fontSize:12 }}>
                        {libLoading ? '…' : '▶ LOAD SET'}

                      </button>
                      <button
                        onClick={() => shareSet(item.id)}
                        disabled={sharingId !== null}
                        className="sf-btn-ghost"
                        style={{ padding:'8px 14px', borderRadius:8, fontSize:11, color: copiedId === item.id ? '#00f0ff' : undefined, borderColor: copiedId === item.id ? '#00f0ff' : undefined }}
                      >
                        {sharingId === item.id ? '…' : copiedId === item.id ? '✓ LINK COPIED' : '⤴ SHARE'}
                      </button>
                    </div>
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

// ── sub-components ────────────────────────────────────────────
function SFLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, letterSpacing:2, color:'#6a6a8a', marginBottom:8 }}>{children}</div>
}

function EnergyBar({ tracks }: { tracks: Track[] }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:52, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:'6px 10px' }}>
      {tracks.map((t,i) => (
        <div key={i} title={`${t.artist} — ${t.title} · E${t.energy}`} style={{ flex:1, height:`${(t.energy/10)*100}%`, minHeight:3, background:`linear-gradient(180deg,${M},${C})`, borderRadius:2, opacity:.85 }} />
      ))}
    </div>
  )
}

function CamelotWheel({ tracks }: { tracks: Track[] }) {
  const [hovered, setHovered] = useState<string|null>(null)
  const SZ=260, CX=130, CY=130, RO=122, RM=84, RI=50

  const keyMap: Record<string, Track[]> = {}
  tracks.forEach(t => {
    const k = (t.key||'').toUpperCase().trim()
    if (!k) return
    if (!keyMap[k]) keyMap[k] = []
    keyMap[k].push(t)
  })
  const usedKeys = new Set(Object.keys(keyMap))

  function polar(r:number, deg:number) {
    const rad = ((deg-90)*Math.PI)/180
    return { x: CX+r*Math.cos(rad), y: CY+r*Math.sin(rad) }
  }
  function segPath(num:number, type:'A'|'B') {
    const s=(num-1)*30, e=num*30
    const r1=type==='B'?RM+1:RI, r2=type==='B'?RO:RM-1
    const p1=polar(r2,s), p2=polar(r2,e), p3=polar(r1,e), p4=polar(r1,s)
    return `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A${r2} ${r2} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} L${p3.x.toFixed(1)} ${p3.y.toFixed(1)} A${r1} ${r1} 0 0 0 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)}Z`
  }
  function segCenter(num:number, type:'A'|'B') {
    return polar(type==='B'?(RO+RM)/2:(RM+RI)/2, (num-0.5)*30)
  }
  const seqPoints = tracks.map(t => {
    const m=(t.key||'').toUpperCase().trim().match(/^(\d+)([AB])$/)
    if (!m) return null
    const c=segCenter(parseInt(m[1]),m[2] as 'A'|'B')
    return `${c.x.toFixed(1)},${c.y.toFixed(1)}`
  }).filter(Boolean).join(' ')

  const hovTracks = hovered ? (keyMap[hovered]||[]) : []

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <div style={{ fontSize:10, letterSpacing:2, color:'#6a6a8a' }}>CAMELOT WHEEL</div>
      <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`} style={{ overflow:'visible' }}>
        {Array.from({length:12},(_,i)=>i+1).map(num => {
          const hue = CAM_HUES[num-1]
          return (['B','A'] as const).map(type => {
            const key=`${num}${type}`, used=usedKeys.has(key), isHov=hovered===key
            const c=segCenter(num,type)
            return (
              <g key={key} onMouseEnter={()=>setHovered(key)} onMouseLeave={()=>setHovered(null)} style={{ cursor:'pointer' }}>
                <path d={segPath(num,type)} fill={used?`hsl(${hue},88%,${type==='B'?60:50}%)`:`hsl(${hue},28%,16%)`} stroke="#06060c" strokeWidth={1.5} opacity={isHov?1:used?0.88:0.5} />
                <text x={c.x} y={c.y-(used&&keyMap[key].length>0?5:0)} textAnchor="middle" dominantBaseline="middle" fontSize={type==='B'?10:8} fontWeight={used?'700':'400'} fill={used?'#fff':'#3a3a58'} fontFamily="'JetBrains Mono',monospace" pointerEvents="none">{key}</text>
                {used && <text x={c.x} y={c.y+7} textAnchor="middle" dominantBaseline="middle" fontSize={6} fill={type==='B'?'rgba(0,0,0,0.75)':'rgba(255,255,255,0.8)'} fontFamily="'JetBrains Mono',monospace" pointerEvents="none">{keyMap[key].map(t=>t.n).join('·')}</text>}
              </g>
            )
          })
        })}
        {seqPoints && <polyline points={seqPoints} fill="none" stroke={C} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.55} strokeLinejoin="round" />}
        {tracks.map((t,i) => {
          const m=(t.key||'').toUpperCase().trim().match(/^(\d+)([AB])$/)
          if (!m) return null
          const c=segCenter(parseInt(m[1]),m[2] as 'A'|'B')
          return <circle key={i} cx={c.x} cy={c.y} r={3} fill={`hsl(${CAM_HUES[parseInt(m[1])-1]},90%,70%)`} stroke="#06060c" strokeWidth={1} opacity={0.9} />
        })}
        <circle cx={CX} cy={CY} r={RI-2} fill="#08080f" stroke="#1a1a2e" strokeWidth={1} />
        <text x={CX} y={CY-7} textAnchor="middle" fontSize={14} fontFamily="'Bebas Neue',sans-serif" fill="#4a4a66">{usedKeys.size}</text>
        <text x={CX} y={CY+7} textAnchor="middle" fontSize={7} fontFamily="'JetBrains Mono',monospace" fill="#3a3a58">KEYS</text>
      </svg>
      <div style={{ minHeight:36, fontSize:11, textAlign:'center', color:'#9a9ab8', lineHeight:1.5, maxWidth:260 }}>
        {hovered
          ? hovTracks.length>0
            ? <><span style={{ color:C, fontWeight:700 }}>{hovered}</span>{' — '}{hovTracks.map(t=>`${t.n}. ${t.title}`).join(' · ')}</>
            : <span style={{ color:'#4a4a66' }}>Not used in this set</span>
          : <span style={{ color:'#4a4a66', fontSize:10, letterSpacing:1 }}>HOVER A KEY TO INSPECT</span>}
      </div>
    </div>
  )
}
