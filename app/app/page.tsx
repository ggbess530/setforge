'use client'

import { useState, useEffect, useRef } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import EnergyEditor, { ENERGY_PRESETS } from '../components/EnergyEditor'
import SetlistImporter, { ImportedTrack } from '../components/SetlistImporter'
import OnboardingWizard, { WizardResult } from '../components/OnboardingWizard'

const GENRE_GROUPS: Record<string, string[]> = {
  'House':           ['House','Tech House','Deep House','Progressive House','Afro House','Melodic House','Soulful House','Tribal House','Bass House','Future House'],
  'Techno':          ['Techno','Melodic Techno','Peak Time Techno','Minimal / Deep Tech','Hard Techno','Industrial Techno','Dub Techno'],
  'Bass & Breaks':   ['Drum & Bass','Dubstep','UK Garage / UKG','Breakbeat','Jungle','Bassline','Future Bass'],
  'Trance':          ['Trance','Progressive Trance','Psytrance','Uplifting Trance','Hard Trance'],
  'Urban / Hip Hop': ['Hip Hop','Trap','R&B','Afrobeats','Amapiano','Reggaeton','Dancehall'],
  'Classic / Groove':['Disco / Funk','Nu-Disco','Funky House','Acid House','Old School / 90s','Italo Disco'],
  'Open Format':     ['Open Format / Multi-Genre','Top 40 / Pop','Latin','Reggae / Dub'],
}
const CROWDS   = ['Club Peak Hour','Warm-Up Set','Festival Main Stage','Wedding','House Party','Rooftop / Lounge']
const ARCS     = ['Slow Build','Peak Time Energy','Cool Down','Wave (up & down)']
const CAM_HUES = [0,30,60,90,120,150,180,210,240,270,300,330]
const C = '#00f0ff'
const M = '#ff1e8a'

type Track   = { n:number; artist:string; title:string; bpm:number; key:string; energy:number; transition:string }
type SetData = { title:string; summary:string; tracks:Track[]; _meta?:Record<string,string> }
type LibItem = { id:string; title:string; meta:Record<string,string|number>; created_at:string }

function camelotCompat(k1: string, k2: string): 'perfect' | 'good' | 'careful' {
  const m1 = (k1||'').toUpperCase().match(/^(\d+)([AB])$/)
  const m2 = (k2||'').toUpperCase().match(/^(\d+)([AB])$/)
  if (!m1 || !m2) return 'careful'
  const n1 = parseInt(m1[1]), t1 = m1[2], n2 = parseInt(m2[1]), t2 = m2[2]
  if (n1 === n2) return 'perfect'
  const diff = Math.abs(n1 - n2)
  if (t1 === t2 && (diff === 1 || diff === 11)) return 'perfect'
  if (diff === 2 || diff === 10) return 'good'
  return 'careful'
}

export default function AppPage() {
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

  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string|null>(null)
  const [set,           setSet]           = useState<SetData|null>(null)
  const [swapping,      setSwapping]      = useState<number|null>(null)
  const [locked,        setLocked]        = useState<Set<number>>(new Set())
  const [copied,        setCopied]        = useState(false)
  const [dragIndex,     setDragIndex]     = useState<number|null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number|null>(null)
  const [quota,         setQuota]         = useState<{ tier:string; remaining:string|number; trial?:{ active:boolean; daysLeft:number }|null; isFree?:boolean }|null>(null)

  const [view,          setView]          = useState<'forge'|'library'|'import'>('forge')
  const [library,       setLibrary]       = useState<LibItem[]>([])
  const [libLoaded,     setLibLoaded]     = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [savedFlash,    setSavedFlash]    = useState(false)
  const [libLoading,    setLibLoading]    = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [deleteConf,    setDeleteConf]    = useState<string|null>(null)
  const [sharingId,     setSharingId]     = useState<string|null>(null)
  const [copiedId,      setCopiedId]      = useState<string|null>(null)
  const [renamingId,    setRenamingId]    = useState<string|null>(null)
  const [renameVal,     setRenameVal]     = useState('')

  const [showWizard,          setShowWizard]          = useState(() => { try { return !localStorage.getItem('sf_onboarded') } catch { return false } })
  const [firstSetCelebration, setFirstSetCelebration] = useState(false)

  // new
  const [hoveredTrackIndex, setHoveredTrackIndex] = useState<number|null>(null)
  const [performanceMode,   setPerformanceMode]   = useState(false)
  const [perfTrackIndex,    setPerfTrackIndex]    = useState(0)
  const [libDragTrack,      setLibDragTrack]      = useState<ImportedTrack|null>(null)
  const [libDropIndex,      setLibDropIndex]      = useState<number|null>(null)
  const [libDropMode,       setLibDropMode]       = useState<'insert'|'replace'>('insert')
  const [leftWidth,         setLeftWidth]         = useState(370)
  const [resizing,          setResizing]          = useState(false)

  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadLibrary() }, [])
  useEffect(() => {
    fetch('/api/quota').then(r => r.json()).then(d => { if (d.tier) setQuota(d) }).catch(() => {})
  }, [])
  useEffect(() => {
    document.body.style.cursor    = resizing ? 'col-resize' : ''
    document.body.style.userSelect = resizing ? 'none' : ''
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = '' }
  }, [resizing])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'library') { setView('library'); window.history.replaceState({}, '', '/app') }
  }, [])
  useEffect(() => { if (renamingId && renameRef.current) renameRef.current.focus() }, [renamingId])
  useEffect(() => {
    if (!performanceMode || !set) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  setPerfTrackIndex(i => Math.min(i+1, set.tracks.length-1))
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    setPerfTrackIndex(i => Math.max(i-1, 0))
      if (e.key === 'Escape') setPerformanceMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [performanceMode, set])

  async function generate(keepLocks = false) {
    setLoading(true); setError(null)
    const lockedTracks = keepLocks && set ? [...locked].map(i => set.tracks[i]).filter(Boolean) : []
    if (!keepLocks) setLocked(new Set())
    setSet(null)
    try {
      const res  = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        genre: effectiveGenre, crowd, arc, vibe, refArtist,
        mode, minutes, count, bpmLow, bpmHigh, keyMatch,
        lockedTracks, energyPoints, includeMixingNotes, recentTracks: [],
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

  async function handleImport(tracks: ImportedTrack[]) {
    setImportLoading(true); setError(null); setSet(null)
    try {
      const res=await fetch('/api/import',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tracks,bpmLow,bpmHigh,keyMatch}) }); const data=await res.json()
      if (!res.ok) { setError(data.error||'Import failed.'); return }
      setSet({...data.set,_meta:{genre:'Imported',crowd:'',arc:'',vibe:'',refArtist:''}}); if (data.quota) setQuota(data.quota)
    } catch { setError('Network error.') }
    finally   { setImportLoading(false) }
  }

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
        if (idx === from)                               next.add(to)
        else if (from < to && idx > from && idx <= to)  next.add(idx - 1)
        else if (from > to && idx < from && idx >= to)  next.add(idx + 1)
        else                                             next.add(idx)
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

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = leftWidth
    setResizing(true)
    function onMove(mv: MouseEvent) { setLeftWidth(Math.max(260, Math.min(620, startW + mv.clientX - startX))) }
    function onUp() { setResizing(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function insertLibraryTrack(position: number, lt: ImportedTrack) {
    if (!set) return
    const tracks = [...set.tracks]
    const prev   = position > 0 ? tracks[position - 1] : null
    const next   = position < tracks.length ? tracks[position] : null
    const energy = prev && next ? Math.round((prev.energy + next.energy) / 2)
                 : prev ? prev.energy : next ? next.energy : 5
    tracks.splice(position, 0, { n: 0, artist: lt.artist, title: lt.title, bpm: lt.bpm || 0, key: lt.key || '', energy, transition: '' })
    setSet(s => s ? { ...s, tracks: tracks.map((t, i) => ({ ...t, n: i + 1 })) } : s)
    setLibDragTrack(null); setLibDropIndex(null)
  }

  function replaceWithLibraryTrack(index: number, lt: ImportedTrack) {
    if (!set) return
    const tracks = [...set.tracks]
    const old    = tracks[index]
    tracks[index] = { n: old.n, artist: lt.artist, title: lt.title, bpm: lt.bpm || old.bpm, key: lt.key || old.key, energy: old.energy, transition: old.transition }
    setSet(s => s ? { ...s, tracks } : s)
    setLibDragTrack(null); setLibDropIndex(null)
  }

  function handleWizardComplete(result: WizardResult) {
    setGenre(result.genre); setCrowd(result.crowd); setArc(result.arc); setVibe(result.vibe); setRefArtist(result.refArtist); setMinutes(result.minutes); setMode('time')
    const presetName = Object.entries(ENERGY_PRESETS).find(([name]) => name.toLowerCase().includes(result.arc.toLowerCase().split(' ')[0]))
    if (presetName) setEnergyPoints([...presetName[1]])
    setShowWizard(false); setFirstSetCelebration(true); setTimeout(()=>generate(false),80)
  }
  function handleWizardSkip() { try { localStorage.setItem('sf_onboarded','true') } catch {}; setShowWizard(false) }

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
        .sf-track { transition:background .15s, border-color .15s; }
        .sf-swap:hover:enabled { border-color:${C}!important; color:${C}!important; }
        .sf-del-btn { background:transparent; border:1px solid #23233a; color:#5a5a78; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:10px; padding:4px 8px; border-radius:5px; transition:.18s; }
        .sf-del-btn:hover { border-color:${M}; color:${M}; }
        .sf-rename-btn { background:transparent; border:none; color:#4a4a66; cursor:pointer; font-size:12px; padding:2px 5px; border-radius:4px; transition:.15s; }
        .sf-rename-btn:hover { color:${C}; }
        .lib-card:hover { border-color:#23233a!important; }
        .sf-slider { -webkit-appearance:none; appearance:none; width:100%; height:8px; border-radius:999px; background:linear-gradient(90deg,${M}33,${C}33); border:1px solid #23233a; outline:none; cursor:pointer; }
        .sf-slider::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg,${M},${C}); border:2px solid #06060c; box-shadow:0 0 10px ${C}66; cursor:grab; }
        .sf-slider::-webkit-slider-thumb:active { cursor:grabbing; }
        .sf-plat { display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:5px; border:1px solid; font-size:10px; font-family:'JetBrains Mono',monospace; text-decoration:none; font-weight:600; transition:opacity .15s,transform .15s; opacity:.75; }
        .sf-plat:hover { opacity:1!important; transform:translateY(-1px); }
        @keyframes rise    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin    { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes flash   { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 20px ${C}88} }
        @keyframes scan    { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        @keyframes shimmer { 0%{background-position:-400% 0} 100%{background-position:400% 0} }
        @keyframes perf-in { from{opacity:0;transform:scale(.98)} to{opacity:1;transform:none} }
        .sf-row { animation:rise .4s ease backwards; }
        .sf-skel { background:linear-gradient(90deg,#0d0d1a 25%,#181830 50%,#0d0d1a 75%); background-size:400% 100%; animation:shimmer 1.6s ease-in-out infinite; border-radius:10px; }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#1f1f33; border-radius:2px; }
      `}</style>

      {showWizard && <OnboardingWizard onComplete={handleWizardComplete} onSkip={handleWizardSkip} />}

      {performanceMode && set && (
        <PerformanceModeView
          tracks={set.tracks}
          currentIndex={perfTrackIndex}
          onPrev={() => setPerfTrackIndex(i => Math.max(0, i-1))}
          onNext={() => setPerfTrackIndex(i => Math.min(set.tracks.length-1, i+1))}
          onExit={() => setPerformanceMode(false)}
        />
      )}

      {/* NAV */}
      <nav style={{ height:52, flexShrink:0, borderBottom:'1px solid #1a1a2e', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', backdropFilter:'blur(12px)', background:'#06060cee', zIndex:40 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Link href="/" style={{ textDecoration:'none' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>
              <span style={{ color:C }} className="sf-glow-c">SET</span><span style={{ color:M }} className="sf-glow-m">FORGE</span>
            </div>
          </Link>
          {quota?.tier && (
            <div style={{
              fontSize:9, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:1.5,
              padding:'2px 8px', borderRadius:4,
              color:  quota.tier==='pro' ? M : quota.tier==='team' ? C : '#5a5a78',
              border: `1px solid ${quota.tier==='pro' ? M+'55' : quota.tier==='team' ? C+'55' : '#2a2a42'}`,
              background: quota.tier==='pro' ? `${M}10` : quota.tier==='team' ? `${C}10` : 'transparent',
            }}>
              {quota.tier.toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {quota?.trial?.active && (
            <div style={{ fontSize:10, padding:'4px 10px', borderRadius:999, border:`1px solid ${quota.trial.daysLeft<=2?M:quota.trial.daysLeft<=4?'#f59e0b':C}`, color:quota.trial.daysLeft<=2?M:quota.trial.daysLeft<=4?'#f59e0b':C }}>
              {quota.trial.daysLeft}d left in trial
            </div>
          )}
          {quota?.isFree && !quota?.trial?.active && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:10, padding:'4px 10px', borderRadius:999, border:'1px solid #2a2a42', color:'#9a9ab8' }}>
                {quota.remaining===0 ? '0 sets left' : `${quota.remaining} free sets left`}
              </div>
              <a href="/#pricing" style={{ textDecoration:'none' }}>
                <div style={{ fontSize:10, padding:'4px 10px', borderRadius:999, background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', fontWeight:700, cursor:'pointer' }}>Upgrade</div>
              </a>
            </div>
          )}
          <Link href="/analyse" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding:'5px 12px', borderRadius:8, fontSize:10, letterSpacing:1 }}>🔍 ANALYSE</button>
          </Link>
          <UserButton />
        </div>
      </nav>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* LEFT PANEL */}
        <div style={{ width:leftWidth, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden', background:'#06060c' }}>
          <div style={{ display:'flex', borderBottom:'1px solid #1a1a2e', flexShrink:0 }}>
            <div className={`sf-tab ${view==='forge'?'on':''}`} onClick={()=>setView('forge')}>⚡ FORGE</div>
            <div className={`sf-tab ${view==='library'?'on':''}`} onClick={()=>{ setView('library'); if(!libLoaded) loadLibrary() }}>
              ◈ LIBRARY{library.length>0&&<span style={{ marginLeft:5, background:M, color:'#06060c', borderRadius:999, fontSize:8, padding:'1px 5px', fontWeight:700 }}>{library.length}</span>}
            </div>
            <div className={`sf-tab ${view==='import'?'on':''}`} onClick={()=>setView('import')}>↑ IMPORT</div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:16 }}>

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
                  <div><SFLabel>CROWD</SFLabel><select className="sf-input sf-select" value={crowd} onChange={e=>setCrowd(e.target.value)}>{CROWDS.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><SFLabel>ARC</SFLabel><select className="sf-input sf-select" value={arc} onChange={e=>setArc(e.target.value)}>{ARCS.map(a=><option key={a}>{a}</option>)}</select></div>
                </div>

                <div><SFLabel>VIBE <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel><input className="sf-input" value={vibe} onChange={e=>setVibe(e.target.value)} placeholder="dark & hypnotic, summery rooftop…" /></div>
                <div><SFLabel>REFERENCE ARTISTS <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel><input className="sf-input" value={refArtist} onChange={e=>setRefArtist(e.target.value)} placeholder="Boris Brejcha, Tale Of Us…" /></div>

                <div><SFLabel>ENERGY CURVE</SFLabel><EnergyEditor points={energyPoints} onChange={setEnergyPoints} /></div>

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
                  <div><SFLabel>BPM LOW</SFLabel><input className="sf-input" type="number" value={bpmLow} onChange={e=>setBpmLow(+e.target.value)} /></div>
                  <div><SFLabel>BPM HIGH</SFLabel><input className="sf-input" type="number" value={bpmHigh} onChange={e=>setBpmHigh(+e.target.value)} /></div>
                </div>

                <div className={`sf-chip ${keyMatch?'on':''}`} onClick={()=>setKeyMatch(!keyMatch)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  ♪ Harmonic mixing {keyMatch?'ON':'OFF'}
                </div>
                <div className={`sf-chip ${includeMixingNotes?'on':''}`} onClick={()=>setIncludeMixingNotes(!includeMixingNotes)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} title="Off = faster, tracklist only">
                  ↳ Mix notes {includeMixingNotes?'ON':'OFF'}
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

            {view==='import' && (
              <div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, letterSpacing:2, color:M, marginBottom:4 }}>BRING YOUR OWN TRACKS</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:'#e8e8f0', marginBottom:4 }}>Import from Rekordbox or Serato</div>
                  <div style={{ fontSize:11, color:'#6a6a8a', lineHeight:1.6 }}>Upload a playlist and AI builds the optimal set ordering.</div>
                </div>
                <SetlistImporter
                  onImport={handleImport}
                  loading={importLoading}
                  setExists={!!set}
                  onLibraryDragStart={track => setLibDragTrack(track)}
                  onLibraryDragEnd={() => { setLibDragTrack(null); setLibDropIndex(null) }}
                />
                {error && <div style={{ marginTop:10, padding:10, border:`1px solid ${M}`, borderRadius:8, color:M, fontSize:11 }}>{error}</div>}
              </div>
            )}
          </div>
        </div>

        {/* RESIZE DIVIDER */}
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          style={{ width:6, flexShrink:0, cursor:'col-resize', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', position:'relative', zIndex:20 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).querySelector('div')!.style.background = C }}
          onMouseLeave={e => { if (!resizing) (e.currentTarget as HTMLElement).querySelector('div')!.style.background = '#2a2a42' }}
        >
          <div style={{ width:2, height:40, borderRadius:999, background: resizing ? C : '#2a2a42', transition:'background .15s, box-shadow .15s', boxShadow: resizing ? `0 0 8px ${C}` : 'none' }} />
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex:1, overflowY:'auto', background:'#07070e', position:'relative' }}>

          {/* Loading beam */}
          {(loading||importLoading) && (
            <div style={{ position:'sticky', top:0, zIndex:10, height:3, background:'#0d0d1a', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, height:'100%', width:'30%', background:`linear-gradient(90deg,transparent,${C},${M},transparent)`, animation:'scan 1.4s linear infinite' }} />
            </div>
          )}

          {/* Loading skeleton */}
          {(loading||importLoading) && (
            <div style={{ padding:24, pointerEvents:'none' }}>
              <div className="sf-skel" style={{ height:36, width:'52%', marginBottom:10 }} />
              <div className="sf-skel" style={{ height:13, width:'75%', marginBottom:20 }} />
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                {[88,108,96,78,120].map((w,i)=><div key={i} className="sf-skel" style={{ height:40, width:w, borderRadius:8 }} />)}
              </div>
              <div className="sf-skel" style={{ height:130, marginBottom:18, borderRadius:12 }} />
              {Array.from({length:5}).map((_,i)=>(
                <div key={i} style={{ marginBottom:6 }}>
                  <div className="sf-skel" style={{ height:70, animationDelay:`${i*0.08}s` }} />
                  {i < 4 && <div style={{ height:24 }} />}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!set && !loading && !importLoading && (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${C}04 1px,transparent 1px),linear-gradient(90deg,${C}04 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 50%,black,transparent 70%)', pointerEvents:'none' }} />
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:120, color:`${C}06`, letterSpacing:4, lineHeight:1, userSelect:'none', marginBottom:-20 }}>SET</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:120, color:`${M}06`, letterSpacing:4, lineHeight:1, userSelect:'none', marginBottom:32 }}>FORGE</div>
              <div style={{ position:'relative' }}>
                <div style={{ fontSize:32, marginBottom:14 }}>🎧</div>
                <div style={{ fontSize:16, fontWeight:600, color:'#4a4a66', marginBottom:8 }}>Your set will appear here</div>
                <div style={{ fontSize:13, color:'#3a3a58', lineHeight:1.6, maxWidth:320 }}>Use the controls on the left to configure your set, then hit Forge.</div>
                <button onClick={tryExample} disabled={loading} style={{ marginTop:24, background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none', padding:'11px 28px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:1 }}>
                  ✦ TRY AN EXAMPLE SET
                </button>
              </div>
            </div>
          )}

          {/* Set results */}
          {set && !loading && !importLoading && (
            <div style={{ padding:24 }}>

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
              <div style={{ marginBottom:16 }}>
                <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, margin:'0 0 4px', letterSpacing:1, color:C }} className="sf-glow-c">{set.title}</h2>
                <div style={{ fontSize:13, color:'#9a9ab8', lineHeight:1.5, marginBottom:10 }}>{set.summary}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                  {[set._meta?.genre||genre, set._meta?.crowd||crowd, set._meta?.arc||arc].map(tag=>tag&&(
                    <span key={tag} style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 8px' }}>{tag}</span>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button onClick={saveSet} disabled={saving} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11, animation:savedFlash?'flash .6s ease':'none', color:savedFlash?C:undefined, borderColor:savedFlash?C:undefined }}>
                    {saving?'SAVING…':savedFlash?'✓ SAVED':'◈ SAVE'}
                  </button>
                  <button onClick={copyTracklist} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11, color:copied?C:undefined, borderColor:copied?C:undefined }}>
                    {copied?'✓ COPIED':'⧉ COPY LIST'}
                  </button>
                  <button onClick={exportText} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11 }}>↓ EXPORT</button>
                  <button
                    onClick={() => { setPerfTrackIndex(0); setPerformanceMode(true) }}
                    style={{ padding:'8px 14px', borderRadius:8, fontSize:11, background:`${C}15`, border:`1px solid ${C}55`, color:C, cursor:'pointer', fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:.5, transition:'.18s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=`${C}28`}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=`${C}15`}
                  >▶ DJ VIEW</button>
                </div>
              </div>

              {/* Stats strip */}
              <SetStatsStrip tracks={set.tracks} />

              {/* Journey chart */}
              <SetJourneyChart
                tracks={set.tracks}
                highlightIndex={hoveredTrackIndex}
                onHover={setHoveredTrackIndex}
              />

              {/* Camelot + key sequence */}
              <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'auto 1fr', gap:16, alignItems:'start' }}>
                <CamelotWheel tracks={set.tracks} />
                <div style={{ display:'flex', flexDirection:'column', gap:4, paddingTop:26 }}>
                  <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a', marginBottom:4 }}>KEY SEQUENCE</div>
                  {set.tracks.map((t,i)=>{
                    const m=(t.key||'').toUpperCase().match(/^(\d+)([AB])$/); const hue=m?CAM_HUES[parseInt(m[1])-1]:null
                    const isHov = hoveredTrackIndex===i
                    return (
                      <div key={i}
                        onMouseEnter={()=>setHoveredTrackIndex(i)}
                        onMouseLeave={()=>setHoveredTrackIndex(null)}
                        style={{ display:'flex', alignItems:'center', gap:7, fontSize:10, cursor:'pointer', borderRadius:5, padding:'2px 4px', background:isHov?`${C}0e`:'transparent', transition:'.12s' }}>
                        <span style={{ color:M, fontFamily:"'Bebas Neue',sans-serif", fontSize:12, minWidth:20 }}>{String(t.n).padStart(2,'0')}</span>
                        {hue!==null && <span style={{ width:7, height:7, borderRadius:'50%', background:`hsl(${hue},85%,58%)`, flexShrink:0, boxShadow:`0 0 5px hsl(${hue},85%,58%)` }} />}
                        <span style={{ color:isHov?C:'#e8e8f0', fontWeight:700, minWidth:28, transition:'.12s' }}>{t.key}</span>
                        <span style={{ color:'#6a6a8a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t.artist} — {t.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Drag-from-library banner */}
              {libDragTrack && (
                <div style={{ background:`${C}0e`, border:`1px dashed ${C}55`, borderRadius:10, padding:'10px 16px', marginTop:14, marginBottom:4, display:'flex', alignItems:'center', gap:10, fontSize:11, color:C }}>
                  <span style={{ fontSize:16 }}>⠿</span>
                  <div>
                    <div style={{ fontWeight:700, marginBottom:1 }}>{libDragTrack.title}</div>
                    <div style={{ fontSize:10, color:`${C}99` }}>{libDragTrack.artist}{libDragTrack.bpm ? ` · ${libDragTrack.bpm} BPM` : ''}{libDragTrack.key ? ` · ${libDragTrack.key}` : ''} — drop to insert or drag over a track to replace</div>
                  </div>
                </div>
              )}

              {/* Track list */}
              <div style={{ marginTop: libDragTrack ? 4 : 18 }}
                onDragEnd={() => { setLibDragTrack(null); setLibDropIndex(null) }}>

                {/* Insert zone — before first track */}
                <InsertDropZone
                  visible={!!libDragTrack}
                  active={libDropIndex === 0 && libDropMode === 'insert'}
                  label="ADD AT START"
                  onDragOver={() => { setLibDropIndex(0); setLibDropMode('insert') }}
                  onDragLeave={() => setLibDropIndex(null)}
                  onDrop={() => libDragTrack && insertLibraryTrack(0, libDragTrack)}
                />

                {set.tracks.map((t,i)=>(
                  <div key={`${t.n}-${t.title}`}>
                    <div
                      className="sf-row sf-track"
                      onMouseEnter={() => !libDragTrack && setHoveredTrackIndex(i)}
                      onMouseLeave={() => setHoveredTrackIndex(null)}
                      onDragOver={e => {
                        e.preventDefault()
                        if (libDragTrack) { setLibDropIndex(i); setLibDropMode('replace') }
                        else setDragOverIndex(i)
                      }}
                      onDragLeave={e => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          if (libDragTrack) setLibDropIndex(null)
                          else setDragOverIndex(null)
                        }
                      }}
                      onDrop={() => {
                        if (libDragTrack) {
                          replaceWithLibraryTrack(i, libDragTrack)
                        } else {
                          if (dragIndex !== null && dragIndex !== i) reorderTracks(dragIndex, i)
                          setDragIndex(null); setDragOverIndex(null)
                        }
                      }}
                      style={{ animationDelay:`${i*0.025}s`, display:'grid', gridTemplateColumns:'18px 28px 1fr auto auto auto', gap:10, alignItems:'center', position:'relative',
                        background: libDropIndex===i && libDropMode==='replace' ? `${M}0e` : hoveredTrackIndex===i ? '#0d0d1c' : '#0a0a14',
                        border: libDropIndex===i && libDropMode==='replace' ? `2px dashed ${M}` : dragOverIndex===i && dragIndex!==i ? `1px solid ${C}` : locked.has(i) ? '1px solid #f59e0b44' : '1px solid #16162a',
                        borderRadius:10, padding:'10px 14px', opacity: dragIndex===i ? 0.35 : swapping===i ? 0.45 : 1 }}>

                      {/* REPLACE chip */}
                      {libDropIndex===i && libDropMode==='replace' && (
                        <div style={{ position:'absolute', top:6, right:80, background:M, color:'#06060c', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:4, letterSpacing:1, zIndex:5, pointerEvents:'none' }}>
                          REPLACE
                        </div>
                      )}

                      <div draggable onDragStart={e=>{e.stopPropagation();setDragIndex(i)}} onDragEnd={()=>{setDragIndex(null);setDragOverIndex(null)}}
                        title="Drag to reorder" style={{ cursor:'grab', color:dragIndex===i?C:'#2a2a48', fontSize:14, textAlign:'center', userSelect:'none' }}>⠿</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:M }} className="sf-glow-m">{String(t.n).padStart(2,'0')}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{t.title}</div>
                        <div style={{ fontSize:11, color:'#8a8aa8', marginBottom:6 }}>{t.artist}</div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          <a href={trackSearchUrl(t,'beatport')}   target="_blank" rel="noopener noreferrer" className="sf-plat" style={{ color:'#01FF95', borderColor:'#01FF9540' }}>● Beatport</a>
                          <a href={trackSearchUrl(t,'spotify')}    target="_blank" rel="noopener noreferrer" className="sf-plat" style={{ color:'#1DB954', borderColor:'#1DB95440' }}>● Spotify</a>
                          <a href={trackSearchUrl(t,'youtube')}    target="_blank" rel="noopener noreferrer" className="sf-plat" style={{ color:'#FF4444', borderColor:'#FF444440' }}>▶ YouTube</a>
                          <a href={trackSearchUrl(t,'soundcloud')} target="_blank" rel="noopener noreferrer" className="sf-plat" style={{ color:'#FF5500', borderColor:'#FF550040' }}>◉ SoundCloud</a>
                        </div>
                        {t.transition && <div style={{ fontSize:10, color:'#5a5a78', marginTop:6 }}>↳ {t.transition}</div>}
                      </div>
                      <div style={{ textAlign:'right', fontSize:11, lineHeight:1.8 }}>
                        <div style={{ color:C }}>{t.bpm || '?'}<span style={{ color:'#4a4a66' }}> BPM</span></div>
                        <div>{t.key || '—'}</div>
                        <div style={{ color:'#5a5a78' }}>E{t.energy}</div>
                      </div>
                      <button onClick={()=>toggleLock(i)} title={locked.has(i)?'Unlock':'Lock'} style={{ background:'transparent', border:`1px solid ${locked.has(i)?'#f59e0b':'#23233a'}`, color:locked.has(i)?'#f59e0b':'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, boxShadow:locked.has(i)?'0 0 8px #f59e0b44':'none' }}>
                        {locked.has(i)?'🔒':'🔓'}
                      </button>
                      <button className="sf-swap" onClick={()=>swapTrack(i)} disabled={swapping!==null||!!libDragTrack} title="Swap track" style={{ background:'transparent', border:'1px solid #23233a', color:swapping===i?M:'#8a8aa8', width:32, height:32, borderRadius:8, cursor:swapping!==null||libDragTrack?'default':'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0 }}>
                        <span style={swapping===i?{animation:'spin .8s linear infinite',display:'inline-block'}:{}}>⟳</span>
                      </button>
                    </div>

                    {/* Between-track zone: drop zone when library dragging, otherwise transition bridge */}
                    {i < set.tracks.length - 1 && (
                      libDragTrack ? (
                        <InsertDropZone
                          visible
                          active={libDropIndex === i+1 && libDropMode === 'insert'}
                          onDragOver={() => { setLibDropIndex(i+1); setLibDropMode('insert') }}
                          onDragLeave={() => setLibDropIndex(null)}
                          onDrop={() => libDragTrack && insertLibraryTrack(i+1, libDragTrack)}
                        />
                      ) : (
                        <TransitionBridge from={t} to={set.tracks[i+1]} />
                      )
                    )}
                  </div>
                ))}

                {/* Insert zone — after last track */}
                <InsertDropZone
                  visible={!!libDragTrack}
                  active={libDropIndex === set.tracks.length && libDropMode === 'insert'}
                  label="ADD AT END"
                  onDragOver={() => { setLibDropIndex(set.tracks.length); setLibDropMode('insert') }}
                  onDragLeave={() => setLibDropIndex(null)}
                  onDrop={() => libDragTrack && insertLibraryTrack(set.tracks.length, libDragTrack)}
                />
              </div>

              <div style={{ marginTop:16, fontSize:10, color:'#3a3a58', textAlign:'center' }}>
                AI-curated blueprints — verify BPM & key in your library before performing.
              </div>
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

function SetStatsStrip({ tracks }: { tracks: Track[] }) {
  const bpms    = tracks.map(t=>t.bpm).filter(Boolean)
  const minBpm  = bpms.length ? Math.min(...bpms) : 0
  const maxBpm  = bpms.length ? Math.max(...bpms) : 0
  const keys    = new Set(tracks.map(t=>(t.key||'').toUpperCase().trim()).filter(Boolean))
  let compat = 0
  for (let i = 0; i < tracks.length-1; i++) {
    const c = camelotCompat(tracks[i].key, tracks[i+1].key)
    if (c === 'perfect' || c === 'good') compat++
  }
  const harmPct = tracks.length > 1 ? Math.round((compat / (tracks.length-1)) * 100) : 100
  const estMin  = Math.round(tracks.length * 4.5)

  const stats = [
    `~${estMin} min`,
    `${tracks.length} tracks`,
    minBpm===maxBpm ? `${minBpm} BPM` : `${minBpm}–${maxBpm} BPM`,
    `${keys.size} keys`,
    `${harmPct}% harmonic`,
  ]
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
      {stats.map((s,i) => (
        <div key={i} style={{ background:'#0a0a14', border:'1px solid #16162a', borderRadius:8, padding:'5px 12px', fontSize:11, color: i===4 ? (harmPct>=80?'#4ade80':harmPct>=60?'#f59e0b':M) : '#c8c8e0', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>
          {s}
        </div>
      ))}
    </div>
  )
}

function SetJourneyChart({ tracks, highlightIndex, onHover }: { tracks: Track[]; highlightIndex: number|null; onHover: (i: number|null) => void }) {
  if (!tracks.length) return null
  const W=800, H=150, PX=24, PY=18, uw=W-PX*2, uh=H-PY*2

  const energyPts = tracks.map((t,i) => ({
    x: PX + (i / Math.max(tracks.length-1, 1)) * uw,
    y: PY + (1 - (t.energy-1)/9) * uh,
    t, i,
  }))

  const bpms   = tracks.map(t=>t.bpm).filter(Boolean)
  const bMin   = Math.min(...bpms), bMax = Math.max(...bpms), bRange = bMax-bMin||1
  const bpmPts = tracks.map((t,i) => ({
    x: PX + (i / Math.max(tracks.length-1, 1)) * uw,
    y: PY + (1 - (t.bpm-bMin)/bRange) * uh,
  }))

  function curve(pts: {x:number;y:number}[], close=false) {
    if (pts.length < 2) return `M${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length-1; i++) {
      const p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)]
      const cp1x=p1.x+(p2.x-p0.x)/6, cp1y=p1.y+(p2.y-p0.y)/6
      const cp2x=p2.x-(p3.x-p1.x)/6, cp2y=p2.y-(p3.y-p1.y)/6
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    if (close) d += ` L ${pts[pts.length-1].x} ${PY+uh} L ${pts[0].x} ${PY+uh} Z`
    return d
  }

  return (
    <div style={{ background:'#0a0a14', border:'1px solid #16162a', borderRadius:12, padding:'12px 10px 6px', marginBottom:16 }}>
      <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a', marginBottom:8, display:'flex', justifyContent:'space-between', padding:'0 4px' }}>
        <span>SET JOURNEY</span>
        <span style={{ display:'flex', gap:12 }}>
          <span style={{ color:M }}>— Energy</span>
          <span style={{ color:`${C}aa` }}>- - BPM</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', display:'block', overflow:'visible' }}>
        <defs>
          <linearGradient id="sj-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={M} stopOpacity="0.28" />
            <stop offset="100%" stopColor={M} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[2,5,8].map(e => {
          const y = PY + (1-(e-1)/9)*uh
          return <g key={e}><line x1={PX} y1={y} x2={W-PX} y2={y} stroke="#16162a" strokeWidth={1} /><text x={PX-6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="#2a2a48" fontFamily="monospace">{e}</text></g>
        })}
        <path d={curve(energyPts, true)} fill="url(#sj-fill)" />
        <path d={curve(energyPts)} fill="none" stroke={M} strokeWidth={2} strokeLinecap="round" />
        <path d={curve(bpmPts)} fill="none" stroke={`${C}70`} strokeWidth={1.5} strokeDasharray="6 4" strokeLinecap="round" />
        {energyPts.map(p => {
          const isHov = highlightIndex===p.i
          const tipX  = Math.max(PX+4, Math.min(p.x, W-PX-160))
          return (
            <g key={p.i} onMouseEnter={()=>onHover(p.i)} onMouseLeave={()=>onHover(null)} style={{ cursor:'pointer' }}>
              {isHov && <line x1={p.x} y1={PY} x2={p.x} y2={PY+uh} stroke={M} strokeWidth={1} strokeDasharray="3 3" opacity={0.35} />}
              <circle cx={p.x} cy={p.y} r={isHov?7:3.5} fill={isHov?M:'#0a0a14'} stroke={M} strokeWidth={isHov?2:1.5} style={{ transition:'r .12s' }} />
              {isHov && (
                <g>
                  <rect x={tipX} y={p.y-58} width={156} height={50} rx={6} fill="#0c0c1c" stroke={M} strokeWidth={1} />
                  <text x={tipX+8} y={p.y-44} fontSize={9} fill={C} fontFamily="monospace">{p.t.artist}</text>
                  <text x={tipX+8} y={p.y-32} fontSize={9} fill="#e8e8f0" fontFamily="monospace">{p.t.title.slice(0,22)}{p.t.title.length>22?'…':''}</text>
                  <text x={tipX+8} y={p.y-19} fontSize={8} fill="#6a6a8a" fontFamily="monospace">{p.t.bpm} BPM · {p.t.key} · E{p.t.energy}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#2a2a48', padding:'0 8px' }}>
        <span>OPENING</span><span>CLOSE</span>
      </div>
    </div>
  )
}

function InsertDropZone({ visible, active, label, onDragOver, onDragLeave, onDrop }: {
  visible:    boolean
  active:     boolean
  label?:     string
  onDragOver: () => void
  onDragLeave: () => void
  onDrop:     () => void
}) {
  if (!visible) return null
  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeave() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      style={{
        height:     active ? 48 : 22,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin:     '3px 0',
        border:     `2px dashed ${active ? C : C+'28'}`,
        borderRadius: 8,
        background: active ? `${C}12` : 'transparent',
        transition: 'all .15s ease',
        cursor:     'copy',
        overflow:   'hidden',
      }}
    >
      {active && (
        <div style={{ fontSize:10, color:C, fontFamily:"'JetBrains Mono',monospace", letterSpacing:1, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:16, fontWeight:700 }}>+</span>
          {label || 'INSERT HERE'}
        </div>
      )}
    </div>
  )
}

function TransitionBridge({ from, to }: { from: Track; to: Track }) {
  const compat      = camelotCompat(from.key, to.key)
  const bpmDelta    = to.bpm - from.bpm
  const energyDelta = to.energy - from.energy
  const compatColor = compat==='perfect' ? '#4ade80' : compat==='good' ? '#f59e0b' : M
  const compatLabel = compat==='perfect' ? '✓ harmonic' : compat==='good' ? '~ near-key' : '✕ key clash'
  const bpmColor    = Math.abs(bpmDelta)<=2 ? '#4ade80' : Math.abs(bpmDelta)<=5 ? '#f59e0b' : M
  const bpmLabel    = bpmDelta===0 ? '= BPM' : (bpmDelta>0?`+${bpmDelta}`:`${bpmDelta}`) + ' BPM'
  const eLabel      = energyDelta===0 ? '= E' : (energyDelta>0?`+${energyDelta}`:`${energyDelta}`) + ' E'

  return (
    <div style={{ display:'flex', alignItems:'center', padding:'2px 14px 2px 66px', height:26 }}>
      <div style={{ width:1, height:'100%', background:'#1a1a2e', marginRight:10, flexShrink:0 }} />
      <span style={{ fontSize:9, color:compatColor, border:`1px solid ${compatColor}44`, borderRadius:4, padding:'1px 7px', fontFamily:'monospace', marginRight:6, flexShrink:0 }}>{compatLabel}</span>
      <span style={{ fontSize:9, color:bpmColor, fontFamily:'monospace', marginRight:8 }}>{bpmLabel}</span>
      <span style={{ fontSize:9, color:'#3a3a58', fontFamily:'monospace' }}>{eLabel}</span>
    </div>
  )
}

function PerformanceModeView({ tracks, currentIndex, onPrev, onNext, onExit }: {
  tracks: Track[]; currentIndex: number; onPrev: ()=>void; onNext: ()=>void; onExit: ()=>void
}) {
  const current = tracks[currentIndex]
  const next    = tracks[currentIndex+1] ?? null
  const prev    = tracks[currentIndex-1] ?? null
  if (!current) return null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, background:'#03030a', display:'flex', flexDirection:'column', fontFamily:"'JetBrains Mono',monospace", animation:'perf-in .22s ease' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom:'1px solid #1a1a2e', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:2 }}>
            <span style={{ color:C }}>DJ</span><span style={{ color:M }}>VIEW</span>
          </div>
          <div style={{ fontSize:10, color:'#3a3a58' }}>← → arrows to navigate · Esc to exit</div>
        </div>
        <button onClick={onExit} style={{ background:'transparent', border:'1px solid #23233a', color:'#6a6a8a', cursor:'pointer', fontFamily:'inherit', fontSize:11, padding:'6px 14px', borderRadius:8, transition:'.15s' }}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=M}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color='#6a6a8a'}>
          ✕ EXIT
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height:2, background:'#0d0d1a', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${((currentIndex+1)/tracks.length)*100}%`, background:`linear-gradient(90deg,${M},${C})`, transition:'width .3s ease' }} />
      </div>

      {/* Content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 48px', textAlign:'center', position:'relative', overflow:'hidden' }}>

        {/* Background glow */}
        <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 50% 60%,${M}08,transparent 65%)`, pointerEvents:'none' }} />

        {/* Track counter */}
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:4, color:'#3a3a58', marginBottom:24 }}>
          {String(currentIndex+1).padStart(2,'0')} / {String(tracks.length).padStart(2,'0')}
        </div>

        {/* Current track */}
        <div style={{ position:'relative', marginBottom:28 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(32px,5.5vw,68px)', lineHeight:1.05, color:C, letterSpacing:2, marginBottom:6 }} className="sf-glow-c">
            {current.title}
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(18px,3vw,32px)', color:'#e8e8f0', letterSpacing:1, marginBottom:20 }}>
            {current.artist}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <div style={{ background:`${C}18`, border:`1px solid ${C}44`, borderRadius:999, padding:'7px 20px', fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C, letterSpacing:1 }}>{current.bpm} BPM</div>
            <div style={{ background:'#0d0d1a', border:'1px solid #23233a', borderRadius:999, padding:'7px 20px', fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:'#e8e8f0', letterSpacing:1 }}>{current.key}</div>
            <div style={{ background:`${M}14`, border:`1px solid ${M}44`, borderRadius:999, padding:'7px 20px', fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:M, letterSpacing:1 }}>E{current.energy}</div>
          </div>
        </div>

        {/* Transition note */}
        {next && current.transition && (
          <div style={{ maxWidth:580, background:'#08080f', border:`1px solid ${C}28`, borderRadius:14, padding:'14px 22px', marginBottom:20 }}>
            <div style={{ fontSize:9, letterSpacing:2, color:C, marginBottom:6 }}>TRANSITION → NEXT TRACK</div>
            <div style={{ fontSize:14, color:'#c8c8e0', lineHeight:1.75 }}>{current.transition}</div>
          </div>
        )}

        {/* Next track */}
        {next && (
          <div style={{ background:'#07070e', border:'1px solid #1a1a2e', borderRadius:10, padding:'10px 22px', display:'inline-flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:9, letterSpacing:2, color:'#3a3a58', flexShrink:0 }}>NEXT →</div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#6a6a8a' }}>{next.title}</div>
              <div style={{ fontSize:10, color:'#3a3a58' }}>{next.artist} · {next.bpm} BPM · {next.key}</div>
            </div>
          </div>
        )}

        {/* Prev ghost */}
        {prev && (
          <div style={{ position:'absolute', top:16, left:24, fontSize:10, color:'#1f1f38', textAlign:'left', maxWidth:200 }}>
            <div style={{ fontSize:8, letterSpacing:1, marginBottom:2 }}>← PREV</div>
            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{prev.artist} — {prev.title}</div>
          </div>
        )}

        {!next && (
          <div style={{ marginTop:16, fontSize:12, color:'#4a4a66' }}>End of set 🎧</div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ display:'flex', gap:12, justifyContent:'center', padding:'18px 24px', borderTop:'1px solid #1a1a2e', flexShrink:0 }}>
        <button onClick={onPrev} disabled={currentIndex===0}
          style={{ padding:'12px 36px', borderRadius:10, fontSize:13, background:'transparent', border:'1px solid #23233a', color:currentIndex===0?'#2a2a48':'#e8e8f0', cursor:currentIndex===0?'default':'pointer', fontFamily:'inherit', letterSpacing:1, transition:'.15s' }}>
          ← PREV
        </button>
        <button onClick={onNext} disabled={currentIndex===tracks.length-1}
          style={{ padding:'12px 48px', borderRadius:10, fontSize:13, background:currentIndex===tracks.length-1?'transparent':`linear-gradient(100deg,${M},${C})`, border:currentIndex===tracks.length-1?'1px solid #23233a':'none', color:currentIndex===tracks.length-1?'#2a2a48':'#06060c', cursor:currentIndex===tracks.length-1?'default':'pointer', fontFamily:'inherit', fontWeight:700, letterSpacing:1, transition:'.15s' }}>
          NEXT →
        </button>
      </div>
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
