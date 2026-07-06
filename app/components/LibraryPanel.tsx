'use client'

import { useState, useEffect } from 'react'
import type { ImportedTrack } from './SetlistImporter'

const C = '#00f0ff'
const M = '#ff1e8a'

interface Crate { id: string; name: string; count: number }
interface Track  { artist: string; title: string; bpm?: number; key?: string }

interface Props {
  onDragStart:  (track: ImportedTrack) => void
  onDragEnd:    () => void
  onBuildSet:   (tracks: ImportedTrack[]) => void
  loading:      boolean
  onUpload:     () => void  // switch to upload panel
}

export default function LibraryPanel({ onDragStart, onDragEnd, onBuildSet, loading, onUpload }: Props) {
  const [crates,  setCrates]  = useState<Crate[]>([])
  const [crateId, setCrateId] = useState('__all__')
  const [tracks,  setTracks]  = useState<Track[]>([])
  const [fetching,setFetching]= useState(false)
  const [search,  setSearch]  = useState('')
  const [hasLib,  setHasLib]  = useState<boolean|null>(null)

  // Load crate list once
  useEffect(() => {
    fetch('/api/user-library')
      .then(r => r.json())
      .then(d => {
        const flat: Crate[] = (d.crates || [])
          .filter((c: {is_folder?: boolean}) => !c.is_folder)
          .map((c: {crate_id?:string;id?:string;name:string;trackCount?:number}) => ({
            id: c.crate_id || c.id || '', name: c.name, count: c.trackCount || 0,
          }))
        setCrates(flat)
        setHasLib((d.trackCount || 0) > 0)
      })
      .catch(() => setHasLib(false))
  }, [])

  // Reload tracks when crate changes
  useEffect(() => {
    if (hasLib === false) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag must flip the instant crateId/hasLib changes, before the fetch below resolves
    setFetching(true); setTracks([])
    fetch(`/api/user-library?crateId=${crateId}`)
      .then(r => r.json())
      .then(d => setTracks(
        (d.tracks || []).map((t: {artist:string;title:string;bpm?:number;key?:string}) => ({
          artist: t.artist, title: t.title, bpm: t.bpm, key: t.key,
        }))
      ))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [crateId, hasLib])

  const q       = search.trim().toLowerCase()
  const visible = q ? tracks.filter(t =>
    t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  ) : tracks

  // ── Empty / no library ─────────────────────────────────────
  if (hasLib === false) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ textAlign:'center', padding:'32px 16px', background:'#06060c', border:'1px solid #1a1a2e', borderRadius:12 }}>
          <div style={{ fontSize:36, marginBottom:10, opacity:.3 }}>📚</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#6a6a8a', marginBottom:6 }}>No library yet</div>
          <div style={{ fontSize:11, color:'#4a4a66', lineHeight:1.6, marginBottom:16 }}>
            Import your Rekordbox, Traktor, or Serato library once — then browse and drag tracks into any set.
          </div>
          <button onClick={onUpload}
            style={{ background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none', padding:'10px 22px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:.5 }}>
            ↑ IMPORT LIBRARY
          </button>
        </div>
      </div>
    )
  }

  // ── Library browser ────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <style>{`@keyframes lp-pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>

      {/* Header: upload button + track count */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:10, color:'#6a6a8a' }}>
          {fetching ? '…' : `${visible.length} tracks`}
          {q && <span style={{ color:'#4a4a66' }}> matching</span>}
        </div>
        <button onClick={onUpload}
          style={{ background:`${C}14`, border:`1px solid ${C}33`, color:C, padding:'3px 10px', borderRadius:6, fontSize:9, cursor:'pointer', fontFamily:'inherit', fontWeight:700, letterSpacing:.5 }}>
          + ADD
        </button>
      </div>

      {/* Crate selector */}
      {crates.length > 0 && (
        <select value={crateId} onChange={e => setCrateId(e.target.value)}
          style={{ width:'100%', background:'#0d0d18', border:'1px solid #1f1f33', color:'#e8e8f0',
            fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'6px 10px', borderRadius:6,
            outline:'none', cursor:'pointer', boxSizing:'border-box',
            backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3l3 3 3-3' stroke='%2300f0ff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
            backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center',
            paddingRight:24, appearance:'none' as const }}>
          <option value="__all__">All tracks ({tracks.length})</option>
          {crates.map(c => <option key={c.id} value={c.id}>{c.name}{c.count>0?` (${c.count})`:''}</option>)}
        </select>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search tracks…"
        style={{ width:'100%', background:'#06060c', border:'1px solid #1f1f33', color:'#e8e8f0',
          fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:'7px 10px', borderRadius:6,
          outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
        onFocus={e => { e.target.style.borderColor = C }}
        onBlur={e  => { e.target.style.borderColor = '#1f1f33' }}
      />

      {/* Drag hint */}
      <div style={{ fontSize:9, color:`${C}88`, display:'flex', alignItems:'center', gap:5 }}>
        <span>⠿</span> Drag any track into your set on the right
      </div>

      {/* Track list */}
      <div style={{ maxHeight:320, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
        {fetching && (
          <div style={{ padding:20, textAlign:'center', fontSize:11, color:'#4a4a66', animation:'lp-pulse 1.2s infinite' }}>
            Loading…
          </div>
        )}
        {!fetching && visible.length === 0 && (
          <div style={{ padding:20, textAlign:'center', fontSize:11, color:'#4a4a66' }}>
            {search ? 'No tracks match.' : 'This crate is empty.'}
          </div>
        )}
        {!fetching && visible.map((t, i) => (
          <div key={i}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; onDragStart(t) }}
            onDragEnd={onDragEnd}
            style={{ display:'flex', alignItems:'center', gap:8, background:'#0a0a14', border:'1px solid #16162a',
              borderRadius:7, padding:'7px 10px', cursor:'grab', transition:'.1s', userSelect:'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${C}44` }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#16162a' }}>
            <div style={{ fontSize:11, color:'#2a2a48', flexShrink:0 }}>⠿</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {t.title}
              </div>
              <div style={{ fontSize:10, color:'#6a6a8a', display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t.artist}</span>
                {t.bpm && <span style={{ color:C, flexShrink:0, fontFamily:"'JetBrains Mono',monospace" }}>{t.bpm}</span>}
                {t.key && <span style={{ color:'#9a9ab8', flexShrink:0, fontFamily:"'JetBrains Mono',monospace" }}>{t.key}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Build set from visible tracks */}
      {visible.length > 0 && (
        <button onClick={() => onBuildSet(visible)} disabled={loading}
          style={{ width:'100%', padding:'11px 0', borderRadius:9, fontSize:11, fontWeight:700,
            background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none',
            cursor:loading?'default':'pointer', fontFamily:"'JetBrains Mono',monospace",
            letterSpacing:.5, opacity:loading?.5:1, transition:'.2s' }}>
          {loading ? 'BUILDING SET…' : `⚡ AI-ORDER ${visible.length} TRACKS`}
        </button>
      )}
    </div>
  )
}
