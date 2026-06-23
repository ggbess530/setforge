// ▸ Place at: app/components/SetlistImporter.tsx

'use client'

import { useState, useRef, useCallback } from 'react'

const C = '#00f0ff'
const M = '#ff1e8a'

export type ImportedTrack = {
  artist: string
  title:  string
  bpm?:   number
  key?:   string
}

interface Props {
  onImport:              (tracks: ImportedTrack[]) => void
  loading:               boolean
  setExists?:            boolean
  onLibraryDragStart?:   (track: ImportedTrack) => void
  onLibraryDragEnd?:     () => void
}

// ── Parsers ──────────────────────────────────────────────────
function parseM3U(content: string): ImportedTrack[] {
  const lines   = content.split('\n').map(l => l.trim()).filter(Boolean)
  const tracks: ImportedTrack[] = []

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      // #EXTINF:duration,Artist - Title
      const m = lines[i].match(/#EXTINF:[^,]*,(.+)/)
      if (m) {
        const info      = m[1].trim()
        const dashIdx   = info.indexOf(' - ')
        if (dashIdx > 0) {
          tracks.push({ artist: info.slice(0, dashIdx).trim(), title: info.slice(dashIdx + 3).trim() })
        } else {
          tracks.push({ artist: 'Unknown', title: info })
        }
      }
    } else if (!lines[i].startsWith('#')) {
      // Plain file path line — extract from filename
      const filename = lines[i].replace(/\\/g, '/').split('/').pop() || ''
      const name     = filename.replace(/\.[^.]+$/, '').trim()
      if (!name) continue
      const dashIdx  = name.indexOf(' - ')
      if (dashIdx > 0) {
        tracks.push({ artist: name.slice(0, dashIdx).trim(), title: name.slice(dashIdx + 3).trim() })
      } else {
        tracks.push({ artist: 'Unknown', title: name })
      }
    }
  }
  return tracks
}

function parseXML(content: string): ImportedTrack[] {
  const tracks: ImportedTrack[] = []
  const tagRegex = /<TRACK\s([^>]+)>/gi
  let match: RegExpExecArray | null

  function attr(tag: string, name: string): string {
    const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'))
    return m ? m[1] : ''
  }

  while ((match = tagRegex.exec(content)) !== null) {
    const tag    = match[1]
    const title  = attr(tag, 'Name')
    const artist = attr(tag, 'Artist')
    const bpmStr = attr(tag, 'BPM')
    const key    = attr(tag, 'Tonality')
    if (title || artist) {
      const bpm = parseFloat(bpmStr)
      tracks.push({
        artist: artist || 'Unknown',
        title:  title  || 'Unknown',
        ...(bpm ? { bpm: Math.round(bpm) } : {}),
        ...(key ? { key } : {}),
      })
    }
    if (tracks.length >= 200) break   // safety cap
  }
  return tracks
}

function parsePlainText(content: string): ImportedTrack[] {
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(line => {
      // Strip leading numbers: "1. " or "01 - "
      const stripped = line.replace(/^\d+[\.\)]\s*/, '').replace(/^\d+\s*-\s*/, '')
      const dashIdx  = stripped.indexOf(' - ')
      if (dashIdx > 0) {
        return { artist: stripped.slice(0, dashIdx).trim(), title: stripped.slice(dashIdx + 3).trim() }
      }
      return { artist: 'Unknown', title: stripped }
    })
}

function parseFile(filename: string, content: string): ImportedTrack[] {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'xml')              return parseXML(content)
  if (ext === 'm3u' || ext === 'm3u8') return parseM3U(content)
  return parsePlainText(content)
}

// ── Component ─────────────────────────────────────────────────
export default function SetlistImporter({ onImport, loading, setExists, onLibraryDragStart, onLibraryDragEnd }: Props) {
  const [tracks,   setTracks]   = useState<ImportedTrack[]>([])
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error,    setError]    = useState<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result as string
      const parsed  = parseFile(file.name, content)
      if (parsed.length === 0) {
        setError("Couldn't find any tracks in that file. Try a .m3u, .xml, or .txt export from Rekordbox or Serato.")
        return
      }
      setError(null)
      setFileName(file.name)
      setTracks(parsed)
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  function removeTrack(i: number) {
    setTracks(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      {/* Drop zone */}
      {tracks.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? C : '#2a2a42'}`,
            borderRadius: 14, padding: '48px 24px', textAlign: 'center',
            cursor: 'pointer', transition: '.2s',
            background: dragging ? `${C}08` : '#06060c',
            boxShadow: dragging ? `0 0 24px ${C}22` : 'none',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎛️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f0', marginBottom: 8 }}>
            Drop your Rekordbox or Serato export here
          </div>
          <div style={{ fontSize: 13, color: '#6a6a8a', marginBottom: 20, lineHeight: 1.6 }}>
            Supports <span style={{ color: C }}>Rekordbox XML</span>, <span style={{ color: C }}>M3U playlists</span>, and <span style={{ color: C }}>plain text</span> tracklists
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${C}18`, border: `1px solid ${C}44`, borderRadius: 999, padding: '8px 20px', fontSize: 12, color: C, fontFamily: "'JetBrains Mono',monospace" }}>
            ↑ Choose file or drag & drop
          </div>
          <input ref={inputRef} type="file" accept=".m3u,.m3u8,.xml,.txt,.nml" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {/* How to export guide */}
      {tracks.length === 0 && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { app: 'Rekordbox', steps: ['Open Rekordbox', 'Right-click a playlist', 'Export Playlist → M3U or XML'] },
            { app: 'Serato', steps: ['Open Serato DJ', 'Right-click a crate', 'Export → Export to M3U'] },
          ].map(guide => (
            <div key={guide.app} style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f0', marginBottom: 8 }}>{guide.app}</div>
              {guide.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#6a6a8a', marginBottom: 4 }}>
                  <span style={{ color: M, flexShrink: 0 }}>{i + 1}.</span>{step}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 12, padding: 14, border: `1px solid ${M}`, borderRadius: 10, color: M, fontSize: 13 }}>{error}</div>
      )}

      {/* Parsed tracks */}
      {tracks.length > 0 && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f0' }}>
                {tracks.length} tracks found
                {fileName && <span style={{ fontSize: 12, color: '#4a4a66', marginLeft: 8 }}>from {fileName}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#6a6a8a', marginTop: 2 }}>
                Remove any tracks you don't want, then build — or drag into your set.
              </div>
            </div>
            <button onClick={() => { setTracks([]); setFileName(''); setError(null) }}
              style={{ background: 'transparent', border: '1px solid #23233a', color: '#6a6a8a', padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✕ Clear
            </button>
          </div>

          {/* Drag hint */}
          {setExists && onLibraryDragStart && (
            <div style={{ background: `${C}0c`, border: `1px solid ${C}33`, borderRadius: 8, padding: '7px 12px', marginBottom: 10, fontSize: 11, color: C, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 14 }}>⠿</span>
              Drag any track directly into your set on the right →
            </div>
          )}

          {/* Track list */}
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {tracks.map((t, i) => (
              <div key={i}
                draggable={!!onLibraryDragStart}
                onDragStart={e => {
                  if (!onLibraryDragStart) return
                  e.dataTransfer.effectAllowed = 'copy'
                  onLibraryDragStart(t)
                }}
                onDragEnd={() => onLibraryDragEnd?.()}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0a0a14', border: '1px solid #16162a', borderRadius: 8, padding: '8px 12px', cursor: onLibraryDragStart ? 'grab' : 'default', transition: '.12s' }}
                onMouseEnter={e => { if (onLibraryDragStart) (e.currentTarget as HTMLElement).style.borderColor = `${C}55` }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#16162a' }}
              >
                {onLibraryDragStart && (
                  <div style={{ fontSize: 13, color: '#3a3a58', flexShrink: 0, cursor: 'grab', padding: '0 2px' }}>⠿</div>
                )}
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: M, minWidth: 28, flexShrink: 0 }}>{String(i+1).padStart(2,'0')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#8a8aa8', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{t.artist}</span>
                    {t.bpm && <span style={{ color: C }}>{t.bpm} BPM</span>}
                    {t.key && <span style={{ color: '#9a9ab8' }}>{t.key}</span>}
                  </div>
                </div>
                <button onClick={() => removeTrack(i)}
                  style={{ background: 'transparent', border: 'none', color: '#3a3a58', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }}
                  title="Remove from set">✕</button>
              </div>
            ))}
          </div>

          {/* Build button */}
          <button
            onClick={() => onImport(tracks)}
            disabled={loading || tracks.length === 0}
            style={{
              background: `linear-gradient(100deg,${M},${C})`, color: '#06060c',
              border: 'none', width: '100%', padding: '15px 0', borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1,
              opacity: loading ? 0.6 : 1, transition: '.2s',
            }}
          >
            {loading ? 'BUILDING ORDERED SET…' : `⚡ BUILD ORDERED SET FROM ${tracks.length} TRACKS`}
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#4a4a66', marginTop: 8 }}>
            AI will find the optimal order, add transition notes, and analyse key compatibility
          </div>
        </div>
      )}
    </div>
  )
}