'use client'

import { useState, useEffect, useRef } from 'react'
import type { ImportedTrack } from './SetlistImporter'

const C = '#00f0ff'
const M = '#ff1e8a'

interface Crate { id: string; name: string; count: number }
interface Track  { artist: string; title: string; bpm?: number; key?: string }

interface Props {
  onDragStart: (track: ImportedTrack) => void
  onDragEnd:   () => void
  onClose:     () => void
}

export default function LibraryPanel({ onDragStart, onDragEnd, onClose }: Props) {
  const [crates,     setCrates]     = useState<Crate[]>([])
  const [crateId,    setCrateId]    = useState('__all__')
  const [tracks,     setTracks]     = useState<Track[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [hasLib,     setHasLib]     = useState<boolean|null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load crates once on mount
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

  // Load tracks when crate changes
  useEffect(() => {
    if (hasLib === false) return
    setLoading(true); setTracks([])
    fetch(`/api/user-library?crateId=${crateId}`)
      .then(r => r.json())
      .then(d => setTracks(
        (d.tracks || []).map((t: {artist:string;title:string;bpm?:number;key?:string}) => ({
          artist: t.artist, title: t.title, bpm: t.bpm, key: t.key,
        }))
      ))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [crateId, hasLib])

  const q       = search.trim().toLowerCase()
  const visible = q
    ? tracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    : tracks

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#06060c' }}>
      <style>{`@keyframes lib-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* Header */}
      <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid #1a1a2e', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#e8e8f0', letterSpacing:.5 }}>📚 MY LIBRARY</div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', color:'#4a4a66', cursor:'pointer', fontSize:16, lineHeight:1, padding:'2px 4px' }}>✕</button>
        </div>

        {/* Crate selector */}
        {crates.length > 0 && (
          <select value={crateId} onChange={e => setCrateId(e.target.value)}
            style={{ width:'100%', background:'#0d0d18', border:'1px solid #1f1f33', color:'#e8e8f0',
              fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'5px 8px', borderRadius:6,
              marginBottom:6, outline:'none', cursor:'pointer', boxSizing:'border-box',
              backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3l3 3 3-3' stroke='%2300f0ff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
              backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center', paddingRight:24, appearance:'none' }}>
            <option value="__all__">All tracks ({tracks.length})</option>
            {crates.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.count > 0 ? ` (${c.count})` : ''}</option>
            ))}
          </select>
        )}

        {/* Search */}
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search artist or title…"
          style={{ width:'100%', background:'#06060c', border:'1px solid #1f1f33', color:'#e8e8f0',
            fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'5px 8px', borderRadius:6,
            outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
          onFocus={e => { e.target.style.borderColor = C }}
          onBlur={e  => { e.target.style.borderColor = '#1f1f33' }}
        />
      </div>

      {/* Status bar */}
      <div style={{ padding:'4px 14px', fontSize:9, color:'#4a4a66', borderBottom:'1px solid #1a1a2e', flexShrink:0, letterSpacing:.5 }}>
        {loading ? 'LOADING…' : hasLib === false ? 'NO LIBRARY' : `${visible.length} TRACKS — DRAG INTO SET`}
      </div>

      {/* Track list */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {hasLib === false && (
          <div style={{ padding:'32px 20px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:10, opacity:.35 }}>📚</div>
            <div style={{ fontSize:12, color:'#6a6a8a', marginBottom:6 }}>No library yet</div>
            <div style={{ fontSize:10, color:'#4a4a66', lineHeight:1.7 }}>
              Go to the 📚 LIBRARY tab to import your Rekordbox, Traktor, or Serato collection.
            </div>
          </div>
        )}

        {hasLib && loading && (
          <div style={{ padding:20, textAlign:'center', fontSize:11, color:'#4a4a66', animation:'lib-pulse 1.2s infinite' }}>
            Loading tracks…
          </div>
        )}

        {hasLib && !loading && visible.length === 0 && (
          <div style={{ padding:20, textAlign:'center', fontSize:11, color:'#4a4a66' }}>
            {search ? 'No tracks match.' : 'This crate is empty.'}
          </div>
        )}

        {hasLib && !loading && visible.map((t, i) => (
          <div key={i}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; onDragStart(t) }}
            onDragEnd={onDragEnd}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
              borderBottom:'1px solid #0d0d14', cursor:'grab', transition:'background .1s',
              userSelect:'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0d0d1a' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <div style={{ fontSize:11, color:'#2a2a48', flexShrink:0 }}>⠿</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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
    </div>
  )
}
