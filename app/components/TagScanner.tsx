// ▸ Place at: app/components/TagScanner.tsx
// Drag audio files in → get BPM + key extracted from ID3 tags
// No server upload — everything runs in the browser

'use client'

import { useState, useCallback } from 'react'
import { scanAudioFiles, toCamelot } from '@/lib/id3-parser'

const C = '#00f0ff', M = '#ff1e8a'

export interface ScannedTrack {
  filename: string
  title?:   string
  artist?:  string
  bpm?:     number
  key?:     string
  camelot?: string
  selected: boolean
}

interface Props {
  onAddToSet?: (tracks: ScannedTrack[]) => void
}

export default function TagScanner({ onAddToSet }: Props) {
  const [tracks,   setTracks]   = useState<ScannedTrack[]>([])
  const [scanning, setScanning] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)

  const processFiles = useCallback(async (files: File[]) => {
    setScanning(true); setProgress(0)
    const AUDIO = ['.mp3','.m4a','.aiff','.aif','.wav','.flac','.ogg']
    const audio  = files.filter(f => AUDIO.some(e => f.name.toLowerCase().endsWith(e)))
    if (!audio.length) { setScanning(false); return }

    const results: ScannedTrack[] = []
    for (let i = 0; i < audio.length; i++) {
      setProgress(Math.round(((i + 1) / audio.length) * 100))
      const [scanned] = await scanAudioFiles([audio[i]])
      if (scanned) {
        results.push({
          filename: scanned.filename,
          title:    scanned.title,
          artist:   scanned.artist,
          bpm:      scanned.bpm,
          key:      scanned.key,
          camelot:  scanned.camelot || (scanned.key ? toCamelot(scanned.key) : undefined),
          selected: true,
        })
      }
    }
    setTracks(prev => {
      // Merge — avoid duplicates by filename
      const existing = new Set(prev.map(t => t.filename))
      return [...prev, ...results.filter(r => !existing.has(r.filename))]
    })
    setScanning(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    processFiles(Array.from(e.dataTransfer.files))
  }, [processFiles])

  function toggleSelect(i: number) {
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, selected: !t.selected } : t))
  }

  function updateField(i: number, field: keyof ScannedTrack, value: string | number) {
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  function removeTrack(i: number) {
    setTracks(prev => prev.filter((_, idx) => idx !== i))
  }

  const selected = tracks.filter(t => t.selected)
  const missing  = tracks.filter(t => !t.bpm || !t.camelot)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          const inp = document.createElement('input')
          inp.type = 'file'
          inp.multiple = true
          inp.accept = '.mp3,.m4a,.aiff,.aif,.wav,.flac,.ogg'
          inp.onchange = e => processFiles(Array.from((e.target as HTMLInputElement).files || []))
          inp.click()
        }}
        style={{
          border: `2px dashed ${dragOver ? C : '#2a2a42'}`,
          borderRadius:12, padding:'28px 20px', textAlign:'center',
          cursor:'pointer', transition:'.2s',
          background: dragOver ? `${C}08` : 'transparent',
          boxShadow: dragOver ? `0 0 24px ${C}22` : 'none',
        }}
      >
        <div style={{ fontSize:32, marginBottom:8 }}>🎵</div>
        <div style={{ fontSize:14, fontWeight:600, color:'#e8e8f0', marginBottom:4 }}>
          Drop audio files here
        </div>
        <div style={{ fontSize:12, color:'#6a6a8a', lineHeight:1.6 }}>
          MP3, M4A, AIFF, WAV, FLAC · Reads BPM + key from file tags<br />
          <span style={{ color:'#4a4a66', fontSize:11 }}>No upload — everything stays on your device</span>
        </div>
      </div>

      {/* Progress */}
      {scanning && (
        <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:10, padding:'12px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:12, color:'#6a6a8a' }}>
            <span style={{ fontFamily:'JetBrains Mono,monospace', animation:'pulse 1.2s infinite' }}>
              Scanning tags…
            </span>
            <span style={{ color:C, fontFamily:'JetBrains Mono,monospace' }}>{progress}%</span>
          </div>
          <div style={{ height:4, background:'#1a1a2e', borderRadius:2 }}>
            <div style={{ height:'100%', width:`${progress}%`, background:`linear-gradient(90deg,${M},${C})`, borderRadius:2, transition:'width .2s' }} />
          </div>
        </div>
      )}

      {/* Results */}
      {tracks.length > 0 && (
        <>
          {/* Summary bar */}
          <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
            <div style={{ fontSize:12, color:'#6a6a8a' }}>
              <span style={{ color:'#e8e8f0', fontWeight:600 }}>{tracks.length}</span> tracks ·{' '}
              <span style={{ color:'#4ade80' }}>{tracks.filter(t => t.bpm && t.camelot).length} with full tags</span>
              {missing.length > 0 && <> · <span style={{ color:'#f59e0b' }}>{missing.length} missing data</span></>}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button
                onClick={() => setTracks(prev => prev.map(t => ({ ...t, selected: true })))}
                style={{ fontSize:10, color:'#6a6a8a', background:'transparent', border:'1px solid #23233a', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontFamily:'inherit' }}>
                All
              </button>
              <button
                onClick={() => setTracks([])}
                style={{ fontSize:10, color:'#5a5a78', background:'transparent', border:'1px solid #23233a', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontFamily:'inherit' }}>
                Clear
              </button>
            </div>
          </div>

          {/* Track list */}
          <div style={{ maxHeight:360, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
            {tracks.map((t, i) => (
              <div key={t.filename}
                style={{ display:'grid', gridTemplateColumns:'20px 1fr auto auto auto', gap:8, alignItems:'center',
                  background: t.selected ? '#0a0a14' : '#06060c',
                  border:`1px solid ${t.selected ? '#1a1a2e' : '#0d0d18'}`,
                  borderRadius:8, padding:'8px 12px', opacity: t.selected ? 1 : 0.5 }}>

                {/* Checkbox */}
                <div onClick={() => toggleSelect(i)}
                  style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${t.selected ? C : '#2a2a42'}`,
                    background: t.selected ? `${C}33` : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {t.selected && <div style={{ width:8, height:8, background:C, borderRadius:2 }} />}
                </div>

                {/* Info */}
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.title || t.filename}
                  </div>
                  <div style={{ fontSize:10, color:'#6a6a8a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.artist || 'Unknown artist'}
                  </div>
                </div>

                {/* BPM — editable */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:52 }}>
                  <div style={{ fontSize:8, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>BPM</div>
                  <input
                    value={t.bpm || ''}
                    onChange={e => updateField(i, 'bpm', parseFloat(e.target.value) || 0)}
                    placeholder="—"
                    style={{ width:50, background:'#06060c', border:`1px solid ${t.bpm ? '#1f1f33' : '#f59e0b44'}`,
                      color: t.bpm ? C : '#f59e0b', fontFamily:'JetBrains Mono,monospace', fontSize:11,
                      padding:'3px 6px', borderRadius:5, textAlign:'center', outline:'none' }}
                  />
                </div>

                {/* Camelot key — editable */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:44 }}>
                  <div style={{ fontSize:8, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>KEY</div>
                  <input
                    value={t.camelot || ''}
                    onChange={e => updateField(i, 'camelot', e.target.value.toUpperCase())}
                    placeholder="—"
                    style={{ width:42, background:'#06060c', border:`1px solid ${t.camelot ? '#1f1f33' : '#f59e0b44'}`,
                      color: t.camelot ? '#9a9ab8' : '#f59e0b', fontFamily:'JetBrains Mono,monospace', fontSize:11,
                      padding:'3px 4px', borderRadius:5, textAlign:'center', outline:'none' }}
                  />
                </div>

                {/* Remove */}
                <button onClick={() => removeTrack(i)}
                  style={{ background:'transparent', border:'none', color:'#3a3a58', cursor:'pointer', fontSize:13, padding:'0 4px' }}>✕</button>
              </div>
            ))}
          </div>

          {/* Action: build set from scanned tracks */}
          {onAddToSet && selected.length > 0 && (
            <button
              onClick={() => onAddToSet(selected)}
              style={{ background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none',
                padding:'12px 0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
                fontFamily:"'JetBrains Mono',monospace", letterSpacing:1, width:'100%' }}>
              ⚡ BUILD SET FROM {selected.length} SCANNED TRACKS
            </button>
          )}
        </>
      )}
    </div>
  )
}
