// ▸ Place at: app/app/page.tsx (full replacement)

'use client'

import { useState, useEffect, useRef } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import EnergyEditor, { ENERGY_PRESETS } from '../components/EnergyEditor'
import MixSimulator from '../components/MixSimulator'
import SetlistImporter, { ImportedTrack } from '../components/SetlistImporter'
import OnboardingWizard, { WizardResult } from '../components/OnboardingWizard'

// ── Constants ─────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────
type Track   = { n:number; artist:string; title:string; bpm:number; key:string; energy:number; transition:string }
type SetData = { title:string; summary:string; tracks:Track[]; _meta?:Record<string,string> }
type LibItem = { id:string; title:string; meta:Record<string,string|number>; created_at:string }

// ── Main component ────────────────────────────────────────────
export default function AppPage() {

  // form
  const [genre,        setGenre]        = useState('Tech House')
  const [crowd,        setCrowd]        = useState('Club Peak Hour')
  const [arc,          setArc]          = useState('Slow Build')
  const [vibe,         setVibe]         = useState('')
  const [refArtist,    setRefArtist]    = useState('')
  const [mode,         setMode]         = useState<'time'|'count'>('time')
  const [minutes,      setMinutes]      = useState(60)
  const [count,        setCount]        = useState(12)
  const [bpmLow,       setBpmLow]       = useState(120)
  const [bpmHigh,      setBpmHigh]      = useState(128)
  const [keyMatch,           setKeyMatch]           = useState(true)
  const [includeMixingNotes, setIncludeMixingNotes] = useState(true)
  const [energyPoints, setEnergyPoints] = useState<number[]>([3,5,6,8,9])
  const [customGenre,  setCustomGenre]  = useState('')
  const effectiveGenre = genre === '__custom__' ? customGenre.trim() : genre

  // generator
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string|null>(null)
  const [set,      setSet]      = useState<SetData|null>(null)
  const [swapping,      setSwapping]      = useState<number|null>(null)
  const [locked,       setLocked]       = useState<Set<number>>(new Set())
  const [copied,       setCopied]       = useState(false)
  const [dragIndex,    setDragIndex]    = useState<number|null>(null)
  const [dragOverIndex,setDragOverIndex]= useState<number|null>(null)
  const [quota,    setQuota]    = useState<{ tier:string; remaining:string|number; trial?:{ active:boolean; daysLeft:number }|null; isFree?:boolean }|null>(null)

  // library
  const [view,        setView]        = useState<'forge'|'library'|'import'>('forge')
  const [library,     setLibrary]     = useState<LibItem[]>([])
  const [libLoaded,   setLibLoaded]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [savedFlash,  setSavedFlash]  = useState(false)
  const [libLoading,  setLibLoading]  = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [deleteConf,  setDeleteConf]  = useState<string|null>(null)
  const [sharingId,   setSharingId]   = useState<string|null>(null)
  const [copiedId,    setCopiedId]    = useState<string|null>(null)
  const [renamingId,  setRenamingId]  = useState<string|null>(null)
  const [renameVal,   setRenameVal]   = useState('')

  // onboarding
  const [showWizard,          setShowWizard]          = useState(() => { try { return !localStorage.getItem('sf_onboarded') } catch { return false } })
  const [firstSetCelebration, setFirstSetCelebration] = useState(false)

  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadLibrary() }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'library') {
      setView('library')
      window.history.replaceState({}, '', '/app')
    }
  }, [])
  useEffect(() => { if (renamingId && renameRef.current) renameRef.current.focus() }, [renamingId])

  // ── Generate ──────────────────────────────────────────────
  async function generate(keepLocks = false) {
    setLoading(true); setError(null)
    const lockedTracks = keepLocks && set ? [...locked].map(i => set.tracks[i]).filter(Boolean) : []
    if (!keepLocks) setLocked(new Set())
    setSet(null)
    try {
      const res  = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
          genre: effectiveGenre, crowd, arc, vibe, refArtist,
          mode, minutes, count, bpmLow, bpmHigh, keyMatch,
          lockedTracks, energyPoints, includeMixingNotes,
          recentTracks: [],
        }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Generation failed.'); return }
      setSet({ ...data.set, _meta:{ genre:effectiveGenre, crowd, arc, vibe, refArtist } })
      if (data.quota) setQuota(data.quota)
      if (keepLocks && lockedTracks.length > 0) {
        const newLocked = new Set<number>()
        lockedTracks.forEach(lt => { const idx = data.set.tracks.findIndex((t: Track) => t.artist===lt.artist && t.title===lt.title); if (idx >= 0) newLocked.add(idx) })
        setLocked(newLocked)
      }
    } catch { setError('Network error. Please try again.') }
    finally   { setLoading(false) }
  }

  function tryExample() {
    setGenre('Tech House'); setCrowd('Club Peak Hour'); setArc('Slow Build')
    setVibe('dark and hypnotic, late night warehouse'); setRefArtist('Fisher, Chris Lake')
    setMode('time'); setMinutes(60); setBpmLow(122); setBpmHigh(128); setKeyMatch(true)
    setEnergyPoints([...ENERGY_PRESETS['Slow build']])
    setTimeout(() => generate(false), 80)
  }

  // ── Swap ──────────────────────────────────────────────────
  async function swapTrack(index: number) {
    if (!set) return
    setSwapping(index); setError(null)
    const target = set.tracks[index]
    try {
      const res  = await fetch('/api/swap', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target, prev:set.tracks[index-1]??null, next:set.tracks[index+1]??null, existing:set.tracks, genre:effectiveGenre, crowd, arc, vibe, refArtist, bpmLow, bpmHigh, keyMatch }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Swap failed.'); return }
      setSet(s => { if (!s) return s; const tracks=[...s.tracks]; tracks[index]={...data.track,n:target.n}; return {...s,tracks} })
    } catch { setError('Network error.') }
    finally   { setSwapping(null) }
  }

  // ── Save ──────────────────────────────────────────────────
  async function saveSet() {
    if (!set||saving) return; setSaving(true)
    try {
      const res  = await fetch('/api/library', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:set.title, setData:set, meta:{ genre:set._meta?.genre||genre, crowd:set._meta?.crowd||crowd, arc:set._meta?.arc||arc, vibe:set._meta?.vibe||vibe, refArtist:set._meta?.refArtist||refArtist, trackCount:set.tracks.length, savedAt:Date.now() } }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error||'Save failed.'); return }
      setLibrary(prev => [data.set,...prev]); setSavedFlash(true); setTimeout(()=>setSavedFlash(false),2000)
    } catch { setError('Network error.') }
    finally   { setSaving(false) }
  }

  // ── Library ───────────────────────────────────────────────
  async function loadLibrary() {
    try { const res=await fetch('/api/library'); const data=await res.json(); if (res.ok) setLibrary(data.sets||[]) } catch {}
    finally { setLibLoaded(true) }
  }

  async function loadSet(id: string) {
    setLibLoading(true)
    try {
      const res=await fetch(`/api/library/item?id=${id}`); const data=await res.json()
      if (!res.ok) { setError(data.error||'Load failed.'); return }
      const saved: SetData = data.set.set_data; setSet(saved)
      if (saved._meta) { setGenre(saved._meta.genre||genre); setCrowd(saved._meta.crowd||crowd); setArc(saved._meta.arc||arc); setVibe(saved._meta.vibe||''); setRefArtist(saved._meta.refArtist||'') }
    } catch { setError('Network error.') }
    finally   { setLibLoading(false) }
  }

  async function deleteSet(id: string) {
    await fetch(`/api/library/item?id=${id}`, { method:'DELETE' })
    setLibrary(prev=>prev.filter(s=>s.id!==id)); setDeleteConf(null)
  }

  async function shareSet(setId: string) {
    setSharingId(setId)
    try {
      const res=await fetch('/api/share',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({setId}) }); const data=await res.json()
      if (!res.ok) { setError(data.error||'Share failed.'); return }
      await navigator.clipboard.writeText(`${window.location.origin}/s?id=${data.shareId}`)
      setCopiedId(setId); setTimeout(()=>setCopiedId(null),2500)
    } catch { setError('Share failed.') }
    finally   { setSharingId(null) }
  }

  async function commitRename(id: string) {
    const trimmed = renameVal.trim(); if (!trimmed) { setRenamingId(null); setRenameVal(''); return }
    try {
      const res=await fetch(`/api/library/item?id=${id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:trimmed}) })
      if (res.ok) { setLibrary(prev=>prev.map(s=>s.id===id?{...s,title:trimmed}:s)); if (set?.title&&renamingId===id) setSet(s=>s?{...s,title:trimmed}:s) }
    } catch {}
    finally { setRenamingId(null); setRenameVal('') }
  }

  // ── Import ────────────────────────────────────────────────
  async function handleImport(tracks: ImportedTrack[]) {
    setImportLoading(true); setError(null); setSet(null)
    try {
      const res=await fetch('/api/import',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tracks,bpmLow,bpmHigh,keyMatch}) }); const data=await res.json()
      if (!res.ok) { setError(data.error||'Import failed.'); return }
      setSet({...data.set,_meta:{genre:'Imported',crowd:'',arc:'',vibe:'',refArtist:''}}); if (data.quota) setQuota(data.quota)
    } catch { setError('Network error.') }
    finally   { setImportLoading(false) }
  }

  // ── Utils ─────────────────────────────────────────────────
  function toggleLock(i: number) { setLocked(prev=>{ const n=new Set(prev); n.has(i)?n.delete(i):n.add(i); return n }) }

  function reorderTracks(from: number, to: number) {
    if (!set || from === to) return
    setSet(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      const [moved] = tracks.splice(from, 1)
      tracks.splice(to, 0, moved)
      return { ...s, tracks: tracks.map((t, i) => ({ ...t, n: i + 1 })) }
    })
    setLocked(prev => {
      const next = new Set<number>()
      prev.forEach(idx => {
        if (idx === from)                              next.add(to)
        else if (from < to && idx > from && idx <= to) next.add(idx - 1)
        else if (from > to && idx < from && idx >= to) next.add(idx + 1)
        else                                            next.add(idx)
      })
      return next
    })
  }

  async function copyTracklist() {
    if (!set) return
    const text = set.tracks.map(t=>`${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title} [${t.bpm} BPM · ${t.key}]`).join('\n')
    try { await navigator.clipboard.writeText(`${set.title.toUpperCase()}\n\n${text}\n\nForged with SetForge — setforge.online`); setCopied(true); setTimeout(()=>setCopied(false),2000) }
    catch { setError('Copy failed.') }
  }

  function exportText() {
    if (!set) return
    const lines=[set.title.toUpperCase(),set.summary,'',...set.tracks.map(t=>`${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title}  [${t.bpm} BPM · ${t.key} · E${t.energy}]\n     ↳ ${t.transition}`),'','Generated with SetForge']
    const a=Object.assign(document.createElement('a'),{ href:URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'})), download:`${set.title.replace(/\s+/g,'_')}.txt` }); a.click()
  }

  function trackSearchUrl(t: Track, platform: 'beatport'|'spotify'|'youtube'|'soundcloud') {
    const q = encodeURIComponent(`${t.artist} ${t.title}`)
    if (platform === 'beatport')   return `https://www.beatport.com/search?q=${q}`
    if (platform === 'spotify')    return `https://open.spotify.com/search/${q}`
    if (platform === 'youtube')    return `https://www.youtube.com/results?search_query=${q}`
    if (platform === 'soundcloud') return `https://soundcloud.com/search?q=${q}`
    return ''
  }

  // ── Wizard ────────────────────────────────────────────────
  function handleWizardComplete(result: WizardResult) {
    setGenre(result.genre); setCrowd(result.crowd); setArc(result.arc); setVibe(result.vibe); setRefArtist(result.refArtist); setMinutes(result.minutes); setMode('time')
    const presetName = Object.entries(ENERGY_PRESETS).find(([name]) => name.toLowerCase().includes(result.arc.toLowerCase().split(' ')[0]))
    if (presetName) setEnergyPoints([...presetName[1]])
    setShowWizard(false); setFirstSetCelebration(true); setTimeout(()=>generate(false),80)
  }
  function handleWizardSkip() { try { localStorage.setItem('sf_onboarded','true') } catch {}; setShowWizard(false) }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#06060c', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .sf-glow-c { text-shadow:0 0 8px ${C},0 0 24px ${C}80; }
        .sf-glow-m { text-shadow:0 0 8px ${M},0 0 24px ${M}80; }
        .sf-input  { background:#0d0d18; border:1px solid #1f1f33; color:#e8e8f0; font-family:'JetBrains Mono',monospace; font-size:12px; padding:8px 11px; border-radius:8px; width:100%; outline:none; transition:.2s; box-sizing:border-box; }
        .sf-input:focus { border-color:${C}; box-shadow:0 0 0 3px ${C}18; }
        .sf-select { -webkit-appearance:none; appearance:none; cursor:pointer; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2300f0ff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:30px; }
        .sf-select optgroup { background:#06060c; color:${M}; font-style:normal; font-weight:700; }
        .sf-select option   { background:#0d0d18; color:#e8e8f0; }
        .sf-chip { cursor:pointer; padding:5px 12px; border-radius:999px; border:1px solid #23233a; background:#0d0d18; font-size:11px; transition:.18s; user-select:none; white-space:nowrap; }
        .sf-chip:hover { border-color:#39395c; }
        .sf-chip.on { border-color:${C}; color:${C}; box-shadow:0 0 10px ${C}33; }
        .sf-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:box-shadow .2s,transform .15s; }
        .sf-btn-primary:hover:enabled { box-shadow:0 0 0 3px ${C}44,0 6px 28px ${C}44,0 6px 28px ${M}28; transform:translateY(-1px); }
        .sf-btn-primary:disabled { opacity:.5; cursor:default; }
        .sf-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; }
        .sf-btn-ghost:hover:enabled { border-color:${C}; color:${C}; }
        .sf-btn-ghost:disabled { opacity:.4; cursor:default; }
        .sf-tab { cursor:pointer; padding:10px 0; font-size:10px; letter-spacing:2px; border-bottom:2px solid transparent; transition:.2s; user-select:none; flex:1; text-align:center; }
        .sf-tab.on { border-color:${C}; color:${C}; }
        .sf-tab:hover:not(.on) { color:#9a9ab8; }
        .sf-track:hover { border-color:#23233a!important; }
        .sf-swap:hover:enabled { border-color:${C}!important; color:${C}!important; }
        .sf-del-btn { background:transparent; border:1px solid #23233a; color:#5a5a78; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:10px; padding:4px 8px; border-radius:5px; transition:.18s; }
        .sf-del-btn:hover { border-color:${M}; color:${M}; }
        .sf-rename-btn { background:transparent; border:none; color:#4a4a66; cursor:pointer; font-size:12px; padding:2px 5px; border-radius:4px; transition:.15s; }
        .sf-rename-btn:hover { color:${C}; }
        .lib-card:hover { border-color:#23233a!important; }
        .sf-slider { -webkit-appearance:none; appearance:none; width:100%; height:8px; border-radius:999px; background:linear-gradient(90deg,${M}33,${C}33); border:1px solid #23233a; outline:none; cursor:pointer; }
        .sf-slider::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg,${M},${C}); border:2px solid #06060c; box-shadow:0 0 10px ${C}66; cursor:grab; }
        .sf-slider::-webkit-slider-thumb:active { cursor:grabbing; }
        @keyframes rise  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin  { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes flash { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 20px ${C}88} }
        @keyframes scan  { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        .sf-row { animation:rise .4s ease backwards; }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#1f1f33; border-radius:2px; }
      `}</style>

      {/* Wizard overlay */}
      {showWizard && <OnboardingWizard onComplete={handleWizardComplete} onSkip={handleWizardSkip} />}

      {/* ── NAV ── */}
      <nav style={{ height:52, flexShrink:0, borderBottom:'1px solid #1a1a2e', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', backdropFilter:'blur(12px)', background:'#06060cee', zIndex:40 }}>
        <Link href="/" style={{ textDecoration:'none' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>
            <span style={{ color:C }} className="sf-glow-c">SET</span><span style={{ color:M }} className="sf-glow-m">FORGE</span>
          </div>
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {quota?.trial?.active && (
            <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", padding:'4px 10px', borderRadius:999, border:`1px solid ${quota.trial.daysLeft<=2?M:quota.trial.daysLeft<=4?'#f59e0b':C}`, color:quota.trial.daysLeft<=2?M:quota.trial.daysLeft<=4?'#f59e0b':C }}>
              {quota.trial.daysLeft}d left in trial
            </div>
          )}
          {quota?.isFree && !quota?.trial?.active && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", padding:'4px 10px', borderRadius:999, border:'1px solid #2a2a42', color:'#9a9ab8' }}>
                {quota.remaining===0 ? '0 sets left' : `${quota.remaining} free sets left`}
              </div>
              <a href="/#pricing" style={{ textDecoration:'none' }}>
                <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", padding:'4px 10px', borderRadius:999, background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', fontWeight:700, cursor:'pointer' }}>Upgrade</div>
              </a>
            </div>
          )}
          <Link href="/analyse" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding:'5px 12px', borderRadius:8, fontSize:10, letterSpacing:1, fontFamily:"'JetBrains Mono',monospace" }}>
              🔍 ANALYSE
            </button>
          </Link>
          <UserButton />
        </div>
      </nav>

      {/* ── SPLIT LAYOUT ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ════ LEFT PANEL ════ */}
        <div style={{ width:370, flexShrink:0, borderRight:'1px solid #1a1a2e', display:'flex', flexDirection:'column', overflow:'hidden', background:'#06060c' }}>

          {/* Tab nav */}
          <div style={{ display:'flex', borderBottom:'1px solid #1a1a2e', flexShrink:0 }}>
            <div className={`sf-tab ${view==='forge'?'on':''}`} onClick={()=>setView('forge')}>⚡ FORGE</div>
            <div className={`sf-tab ${view==='library'?'on':''}`} onClick={()=>{ setView('library'); if(!libLoaded) loadLibrary() }}>
              ◈ LIBRARY{library.length>0&&<span style={{ marginLeft:5, background:M, color:'#06060c', borderRadius:999, fontSize:8, padding:'1px 5px', fontWeight:700 }}>{library.length}</span>}
            </div>
            <div className={`sf-tab ${view==='import'?'on':''}`} onClick={()=>setView('import')}>↑ IMPORT</div>
          </div>

          {/* Scrollable panel content */}
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>

            {/* ══ FORGE FORM ══ */}
            {view==='forge' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                <SFLabel>GENRE</SFLabel>
                <div>
                  <select className="sf-input sf-select" value={genre} onChange={e=>setGenre(e.target.value)} style={{ marginBottom: genre==='__custom__'?8:0 }}>
                    <option value="__custom__">✦ Custom — describe your own…</option>
                    {Object.entries(GENRE_GROUPS).map(([grp,items])=>(
                      <optgroup key={grp} label={grp}>{items.map(g=><option key={g} value={g}>{g}</option>)}</optgroup>
                    ))}
                  </select>
                  {genre==='__custom__' && <input className="sf-input" value={customGenre} onChange={e=>setCustomGenre(e.target.value.slice(0,120))} placeholder="e.g. 90s french house with disco edits…" autoFocus />}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <SFLabel>CROWD</SFLabel>
                    <select className="sf-input sf-select" value={crowd} onChange={e=>setCrowd(e.target.value)}>
                      {CROWDS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <SFLabel>ARC</SFLabel>
                    <select className="sf-input sf-select" value={arc} onChange={e=>setArc(e.target.value)}>
                      {ARCS.map(a=><option key={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <SFLabel>VIBE <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel>
                  <input className="sf-input" value={vibe} onChange={e=>setVibe(e.target.value)} placeholder="dark & hypnotic, summery rooftop…" />
                </div>

                <div>
                  <SFLabel>REFERENCE ARTISTS <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel>
                  <input className="sf-input" value={refArtist} onChange={e=>setRefArtist(e.target.value)} placeholder="Boris Brejcha, Tale Of Us…" />
                </div>

                <div>
                  <SFLabel>ENERGY CURVE</SFLabel>
                  <EnergyEditor points={energyPoints} onChange={setEnergyPoints} />
                </div>

                <div>
                  <SFLabel>SET LENGTH</SFLabel>
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    <div className={`sf-chip ${mode==='time'?'on':''}`} onClick={()=>setMode('time')}>By Time</div>
                    <div className={`sf-chip ${mode==='count'?'on':''}`} onClick={()=>setMode('count')}>By Count</div>
                  </div>
                  <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:10, padding:'12px 14px' }}>
                    {mode==='time' ? (
                      <>
                        <input type="range" min={15} max={240} step={15} value={minutes} onChange={e=>setMinutes(+e.target.value)} className="sf-slider" style={{ marginBottom:8 }} />
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                          <span style={{ fontSize:24, fontFamily:"'Bebas Neue',sans-serif", color:C }} className="sf-glow-c">{minutes} MIN</span>
                          <span style={{ fontSize:11, color:'#6a6a8a' }}>~{Math.round(minutes/4.5)} tracks</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <input type="range" min={4} max={50} value={count} onChange={e=>setCount(+e.target.value)} className="sf-slider" style={{ marginBottom:8 }} />
                        <span style={{ fontSize:24, fontFamily:"'Bebas Neue',sans-serif", color:C }} className="sf-glow-c">{count} TRACKS</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <SFLabel>BPM LOW</SFLabel>
                    <input className="sf-input" type="number" value={bpmLow} onChange={e=>setBpmLow(+e.target.value)} />
                  </div>
                  <div>
                    <SFLabel>BPM HIGH</SFLabel>
                    <input className="sf-input" type="number" value={bpmHigh} onChange={e=>setBpmHigh(+e.target.value)} />
                  </div>
                </div>

                <div className={`sf-chip ${keyMatch?'on':''}`} onClick={()=>setKeyMatch(!keyMatch)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  ♪ Harmonic mixing {keyMatch?'ON':'OFF'}
                </div>
                <div className={`sf-chip ${includeMixingNotes?'on':''}`} onClick={()=>setIncludeMixingNotes(!includeMixingNotes)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} title="Off = faster, tracklist only">
                  ↳ Mix notes {includeMixingNotes?'ON':'OFF'}
                  ♪ Harmonic mixing {keyMatch?'ON':'OFF'}
                </div>

                <button className="sf-btn-primary" onClick={()=>generate(false)} disabled={loading||(genre==='__custom__'&&!customGenre.trim())} style={{ padding:'13px 0', borderRadius:10, fontSize:14, letterSpacing:2, width:'100%', marginTop:4 }}>
                  {loading?'FORGING…':'⚡ FORGE SET'}
                </button>

                <button onClick={tryExample} disabled={loading} className="sf-btn-ghost" style={{ padding:'9px 0', borderRadius:8, fontSize:11, letterSpacing:1, width:'100%' }}>
                  ✦ TRY AN EXAMPLE SET
                </button>

                {locked.size>0 && (
                  <button onClick={()=>generate(true)} disabled={loading} className="sf-btn-ghost" style={{ padding:'9px 0', borderRadius:8, fontSize:11, color:'#f59e0b', borderColor:'#f59e0b44', width:'100%' }}>
                    ↻ REFORGE ({locked.size} locked)
                  </button>
                )}

                {error && (
                  <div style={{ padding:12, border:`1px solid ${M}`, borderRadius:10, color:M, fontSize:12, lineHeight:1.5 }}>
                    {error}
                    {(error.includes('free sets')||error.includes('trial')||error.includes('subscription')) && (
                      <a href="/#pricing" style={{ display:'block', marginTop:8, color:C, textDecoration:'underline', fontSize:11 }}>View upgrade options →</a>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* ══ LIBRARY ══ */}
            {view==='library' && (
              <div>
                {!libLoaded ? (
                  <div style={{ textAlign:'center', padding:40, color:'#6a6a8a', fontSize:11, animation:'pulse 1.2s infinite' }}>LOADING LIBRARY…</div>
                ) : library.length===0 ? (
                  <div style={{ textAlign:'center', padding:40 }}>
                    <div style={{ fontSize:28, opacity:.3, marginBottom:8 }}>◈</div>
                    <div style={{ fontSize:12, color:'#6a6a8a' }}>No saved sets yet.</div>
                    <div style={{ fontSize:11, color:'#4a4a66', marginTop:4 }}>Forge a set and hit Save.</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {library.map((item,i)=>(
                      <div key={item.id} className="sf-row lib-card" style={{ animationDelay:`${i*0.04}s`, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:12 }}>
                        {renamingId===item.id ? (
                          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                            <input ref={renameRef} className="sf-input" value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') commitRename(item.id); if(e.key==='Escape'){ setRenamingId(null); setRenameVal('') } }} style={{ fontSize:12 }} />
                            <button onClick={()=>commitRename(item.id)} style={{ background:C, color:'#06060c', border:'none', padding:'0 10px', borderRadius:6, fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>SAVE</button>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:.5, color:C, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} className="sf-glow-c">{item.title}</div>
                            <button className="sf-rename-btn" onClick={()=>{ setRenamingId(item.id); setRenameVal(item.title) }} title="Rename">✏</button>
                          </div>
                        )}
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                          {[item.meta?.genre, item.meta?.crowd].map(tag=>tag&&(
                            <span key={String(tag)} style={{ fontSize:9, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'1px 7px' }}>{String(tag)}</span>
                          ))}
                          {item.meta?.trackCount && <span style={{ fontSize:9, color:'#4a4a66', border:'1px solid #1f1f33', borderRadius:999, padding:'1px 7px' }}>{item.meta.trackCount} tracks</span>}
                        </div>
                        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                          <button onClick={()=>shareSet(item.id)} disabled={sharingId!==null} className="sf-btn-ghost" style={{ padding:'4px 8px', borderRadius:6, fontSize:9, color:copiedId===item.id?C:undefined, borderColor:copiedId===item.id?C:undefined, flex:1 }}>
                            {sharingId===item.id?'…':copiedId===item.id?'✓ COPIED':'⤴ SHARE'}
                          </button>
                          <button onClick={()=>loadSet(item.id)} disabled={libLoading} className="sf-btn-ghost" style={{ padding:'4px 8px', borderRadius:6, fontSize:9, flex:1 }}>
                            {libLoading?'…':'▶ LOAD'}
                          </button>
                          {deleteConf===item.id ? (
                            <>
                              <button onClick={()=>deleteSet(item.id)} style={{ background:M, color:'#06060c', border:'none', padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>YES</button>
                              <button className="sf-del-btn" onClick={()=>setDeleteConf(null)}>NO</button>
                            </>
                          ) : (
                            <button className="sf-del-btn" onClick={()=>{ setDeleteConf(item.id); setRenamingId(null) }}>✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══ IMPORT ══ */}
            {view==='import' && (
              <div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, letterSpacing:2, color:M, marginBottom:4 }}>BRING YOUR OWN TRACKS</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:'#e8e8f0', marginBottom:4 }}>Import from Rekordbox or Serato</div>
                  <div style={{ fontSize:11, color:'#6a6a8a', lineHeight:1.6 }}>Upload a playlist and AI builds the optimal set ordering.</div>
                </div>
                <SetlistImporter onImport={handleImport} loading={importLoading} />
                {error && <div style={{ marginTop:10, padding:10, border:`1px solid ${M}`, borderRadius:8, color:M, fontSize:11 }}>{error}</div>}
              </div>
            )}

          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div style={{ flex:1, overflowY:'auto', background:'#07070e', position:'relative' }}>

          {/* ── Loading beam ── */}
          {(loading||importLoading) && (
            <div style={{ position:'sticky', top:0, zIndex:10, height:3, background:'#0d0d1a', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, height:'100%', width:'30%', background:`linear-gradient(90deg,transparent,${C},${M},transparent)`, animation:'scan 1.4s linear infinite' }} />
            </div>
          )}

          {/* ── Empty state ── */}
          {!set && !loading && !importLoading && (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${C}04 1px,transparent 1px),linear-gradient(90deg,${C}04 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 50%,black,transparent 70%)', pointerEvents:'none' }} />
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:120, color:`${C}06`, letterSpacing:4, lineHeight:1, userSelect:'none', marginBottom:-20 }}>SET</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:120, color:`${M}06`, letterSpacing:4, lineHeight:1, userSelect:'none', marginBottom:32 }}>FORGE</div>
              <div style={{ position:'relative' }}>
                <div style={{ fontSize:32, marginBottom:14 }}>🎧</div>
                <div style={{ fontSize:16, fontWeight:600, color:'#4a4a66', marginBottom:8 }}>Your set will appear here</div>
                <div style={{ fontSize:13, color:'#3a3a58', lineHeight:1.6, maxWidth:320 }}>
                  Use the controls on the left to configure your set, then hit Forge.
                </div>
                <button onClick={tryExample} disabled={loading} style={{ marginTop:24, background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none', padding:'11px 28px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:1 }}>
                  ✦ TRY AN EXAMPLE SET
                </button>
              </div>
            </div>
          )}

          {/* ── Set results ── */}
          {set && (
            <div style={{ padding:24 }}>

              {/* First set celebration */}
              {firstSetCelebration && (
                <div style={{ background:`linear-gradient(135deg,${M}14,${C}14)`, border:`1px solid ${C}44`, borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ fontSize:28, flexShrink:0 }}>🎉</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#e8e8f0', marginBottom:4 }}>Your first set is ready!</div>
                    <div style={{ fontSize:12, color:'#9a9ab8', lineHeight:1.6 }}>Swap any track, drag to reorder, lock your favourites — then save or share.</div>
                  </div>
                  <button onClick={()=>setFirstSetCelebration(false)} style={{ background:'none', border:'none', color:'#4a4a66', cursor:'pointer', fontSize:16, flexShrink:0 }}>✕</button>
                </div>
              )}

              {/* Header */}
              <div style={{ marginBottom:18 }}>
                <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, margin:'0 0 4px', letterSpacing:1, color:C }} className="sf-glow-c">{set.title}</h2>
                <div style={{ fontSize:13, color:'#9a9ab8', lineHeight:1.5, marginBottom:10 }}>{set.summary}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                  {[set._meta?.genre||genre, set._meta?.crowd||crowd, set._meta?.arc||arc].map(tag=>tag&&(
                    <span key={tag} style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 8px' }}>{tag}</span>
                  ))}
                </div>
                {/* Action buttons */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button onClick={saveSet} disabled={saving} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11, animation:savedFlash?'flash .6s ease':'none', color:savedFlash?C:undefined, borderColor:savedFlash?C:undefined }}>
                    {saving?'SAVING…':savedFlash?'✓ SAVED':'◈ SAVE'}
                  </button>
                  <button onClick={copyTracklist} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11, color:copied?C:undefined, borderColor:copied?C:undefined }}>
                    {copied?'✓ COPIED':'⧉ COPY LIST'}
                  </button>
                  <button onClick={exportText} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11 }}>↓ EXPORT</button>
                </div>
              </div>

              {/* Energy bar */}
              <EnergyBar tracks={set.tracks} />

              {/* Camelot + key sequence */}
              <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'auto 1fr', gap:16, alignItems:'start' }}>
                <CamelotWheel tracks={set.tracks} />
                <div style={{ display:'flex', flexDirection:'column', gap:5, paddingTop:26 }}>
                  <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a', marginBottom:4 }}>KEY SEQUENCE</div>
                  {set.tracks.map((t,i)=>{
                    const m=(t.key||'').toUpperCase().match(/^(\d+)([AB])$/); const hue=m?CAM_HUES[parseInt(m[1])-1]:null
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:10 }}>
                        <span style={{ color:M, fontFamily:"'Bebas Neue',sans-serif", fontSize:12, minWidth:20 }}>{String(t.n).padStart(2,'0')}</span>
                        {hue!==null && <span style={{ width:7, height:7, borderRadius:'50%', background:`hsl(${hue},85%,58%)`, flexShrink:0, boxShadow:`0 0 5px hsl(${hue},85%,58%)` }} />}
                        <span style={{ color:'#e8e8f0', fontWeight:700, minWidth:28 }}>{t.key}</span>
                        <span style={{ color:'#6a6a8a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t.artist} — {t.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Track list */}
              <div style={{ marginTop:18, display:'flex', flexDirection:'column', gap:7 }}>
                {set.tracks.map((t,i)=>(
                  <div
                    key={`${t.n}-${t.title}`}
                    className="sf-row sf-track"
                    onDragOver={e => { e.preventDefault(); setDragOverIndex(i) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIndex(null) }}
                    onDrop={() => { if (dragIndex !== null && dragIndex !== i) reorderTracks(dragIndex, i); setDragIndex(null); setDragOverIndex(null) }}
                    style={{ animationDelay:`${i*0.025}s`, display:'grid', gridTemplateColumns:'18px 28px 1fr auto auto auto', gap:10, alignItems:'center', background:'#0a0a14',
                      border: dragOverIndex===i && dragIndex!==i ? `1px solid ${C}` : locked.has(i) ? '1px solid #f59e0b44' : '1px solid #16162a',
                      borderRadius:10, padding:'10px 14px', opacity: dragIndex===i ? 0.35 : swapping===i ? 0.45 : 1, transition:'.15s' }}>
                    {/* drag handle */}
                    <div
                      draggable
                      onDragStart={e => { e.stopPropagation(); setDragIndex(i) }}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                      title="Drag to reorder"
                      style={{ cursor:'grab', color: dragIndex===i ? C : '#2a2a48', fontSize:14, textAlign:'center', userSelect:'none', padding:'2px' }}
                    >⠿</div>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:M }} className="sf-glow-m">{String(t.n).padStart(2,'0')}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700 }}>{t.title}</div>
                      <div style={{ fontSize:11, color:'#8a8aa8', display:'flex', alignItems:'center', gap:7 }}>
                        <span>{t.artist}</span>
                        <a href={trackSearchUrl(t,'beatport')}   target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#01FF95', textDecoration:'none', border:'1px solid #01FF9533', borderRadius:3, padding:'1px 5px' }}>BP</a>
                        <a href={trackSearchUrl(t,'spotify')}    target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#1DB954', textDecoration:'none', border:'1px solid #1DB95433', borderRadius:3, padding:'1px 5px' }}>SP</a>
                        <a href={trackSearchUrl(t,'youtube')}    target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#FF0000', textDecoration:'none', border:'1px solid #FF000033', borderRadius:3, padding:'1px 5px' }}>YT</a>
                        <a href={trackSearchUrl(t,'soundcloud')} target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#FF5500', textDecoration:'none', border:'1px solid #FF550033', borderRadius:3, padding:'1px 5px' }}>SC</a>
                      </div>
                      {t.transition && <div style={{ fontSize:10, color:'#5a5a78', marginTop:2 }}>↳ {t.transition}</div>}
                    </div>
                    <div style={{ textAlign:'right', fontSize:11, lineHeight:1.7 }}>
                      <div style={{ color:C }}>{t.bpm}<span style={{ color:'#4a4a66' }}> BPM</span></div>
                      <div>{t.key}</div>
                      <div style={{ color:'#5a5a78' }}>E{t.energy}</div>
                    </div>
                    <button onClick={()=>toggleLock(i)} title={locked.has(i)?'Unlock':'Lock'} style={{ background:'transparent', border:`1px solid ${locked.has(i)?'#f59e0b':'#23233a'}`, color:locked.has(i)?'#f59e0b':'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, boxShadow:locked.has(i)?'0 0 8px #f59e0b44':'none' }}>
                      {locked.has(i)?'🔒':'🔓'}
                    </button>
                    <button className="sf-swap" onClick={()=>swapTrack(i)} disabled={swapping!==null} title="Swap track" style={{ background:'transparent', border:'1px solid #23233a', color:swapping===i?M:'#8a8aa8', width:32, height:32, borderRadius:8, cursor:swapping!==null?'default':'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0 }}>
                      <span style={swapping===i?{animation:'spin .8s linear infinite',display:'inline-block'}:{}}>⟳</span>
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:14, fontSize:10, color:'#3a3a58', textAlign:'center' }}>
                AI-curated blueprints — verify BPM & key in your library before performing.
              </div>

              {/* Mix Simulator */}
              <MixSimulator tracks={set.tracks} />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────
function SFLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a', marginBottom:6 }}>{children}</div>
}

function EnergyBar({ tracks }: { tracks: Track[] }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:44, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:'5px 10px' }}>
      {tracks.map((t,i)=>(
        <div key={i} title={`${t.artist} — ${t.title} · E${t.energy}`} style={{ flex:1, height:`${(t.energy/10)*100}%`, minHeight:2, background:`linear-gradient(180deg,${M},${C})`, borderRadius:2, opacity:.85 }} />
      ))}
    </div>
  )
}

function CamelotWheel({ tracks }: { tracks: Track[] }) {
  const [hovered, setHovered] = useState<string|null>(null)
  const SZ=220, CX=110, CY=110, RO=104, RM=72, RI=44

  const keyMap: Record<string,Track[]> = {}
  tracks.forEach(t=>{ const k=(t.key||'').toUpperCase().trim(); if(!k) return; if(!keyMap[k]) keyMap[k]=[]; keyMap[k].push(t) })
  const usedKeys=new Set(Object.keys(keyMap))

  function polar(r:number,deg:number){ const rad=((deg-90)*Math.PI)/180; return{x:CX+r*Math.cos(rad),y:CY+r*Math.sin(rad)} }
  function segPath(num:number,type:'A'|'B'){ const s=(num-1)*30,e=num*30,r1=type==='B'?RM+1:RI,r2=type==='B'?RO:RM-1,p1=polar(r2,s),p2=polar(r2,e),p3=polar(r1,e),p4=polar(r1,s); return `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A${r2} ${r2} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} L${p3.x.toFixed(1)} ${p3.y.toFixed(1)} A${r1} ${r1} 0 0 0 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)}Z` }
  function segCenter(num:number,type:'A'|'B'){ return polar(type==='B'?(RO+RM)/2:(RM+RI)/2,(num-0.5)*30) }

  const seqPoints=tracks.map(t=>{ const m=(t.key||'').toUpperCase().trim().match(/^(\d+)([AB])$/); if(!m) return null; const c=segCenter(parseInt(m[1]),m[2] as 'A'|'B'); return `${c.x.toFixed(1)},${c.y.toFixed(1)}` }).filter(Boolean).join(' ')
  const hovTracks=hovered?(keyMap[hovered]||[]):[]

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a' }}>CAMELOT WHEEL</div>
      <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`} style={{ overflow:'visible' }}>
        {Array.from({length:12},(_,i)=>i+1).map(num=>{
          const hue=CAM_HUES[num-1]
          return (['B','A'] as const).map(type=>{
            const key=`${num}${type}`,used=usedKeys.has(key),isHov=hovered===key,c=segCenter(num,type)
            return (
              <g key={key} onMouseEnter={()=>setHovered(key)} onMouseLeave={()=>setHovered(null)} style={{cursor:'pointer'}}>
                <path d={segPath(num,type)} fill={used?`hsl(${hue},88%,${type==='B'?60:50}%)`:`hsl(${hue},28%,14%)`} stroke="#07070e" strokeWidth={1.5} opacity={isHov?1:used?0.88:0.45} />
                <text x={c.x} y={c.y-(used&&keyMap[key].length>0?4:0)} textAnchor="middle" dominantBaseline="middle" fontSize={type==='B'?8:7} fontWeight={used?'700':'400'} fill={used?'#fff':'#2a2a48'} fontFamily="'JetBrains Mono',monospace" pointerEvents="none">{key}</text>
                {used&&<text x={c.x} y={c.y+5} textAnchor="middle" dominantBaseline="middle" fontSize={5} fill={type==='B'?'rgba(0,0,0,.7)':'rgba(255,255,255,.7)'} fontFamily="'JetBrains Mono',monospace" pointerEvents="none">{keyMap[key].map(t=>t.n).join('·')}</text>}
              </g>
            )
          })
        })}
        {seqPoints&&<polyline points={seqPoints} fill="none" stroke={C} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.55} strokeLinejoin="round" />}
        {tracks.map((t,i)=>{ const m=(t.key||'').toUpperCase().trim().match(/^(\d+)([AB])$/); if(!m) return null; const c=segCenter(parseInt(m[1]),m[2] as 'A'|'B'); return <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={`hsl(${CAM_HUES[parseInt(m[1])-1]},90%,70%)`} stroke="#07070e" strokeWidth={1} opacity={0.9} /> })}
        <circle cx={CX} cy={CY} r={RI-2} fill="#06060c" stroke="#1a1a2e" strokeWidth={1} />
        <text x={CX} y={CY-5} textAnchor="middle" fontSize={12} fontFamily="'Bebas Neue',sans-serif" fill="#3a3a58">{usedKeys.size}</text>
        <text x={CX} y={CY+6} textAnchor="middle" fontSize={6} fontFamily="'JetBrains Mono',monospace" fill="#2a2a48">KEYS</text>
      </svg>
      <div style={{ minHeight:28, fontSize:10, textAlign:'center', color:'#9a9ab8', lineHeight:1.5, maxWidth:220 }}>
        {hovered
          ? hovTracks.length>0
            ? <><span style={{color:C,fontWeight:700}}>{hovered}</span>{' — '}{hovTracks.map(t=>`${t.n}. ${t.title}`).join(' · ')}</>
            : <span style={{color:'#4a4a66'}}>Not used in this set</span>
          : <span style={{color:'#3a3a58',fontSize:9,letterSpacing:1}}>HOVER A KEY TO INSPECT</span>}
      </div>
    </div>
  )
}
