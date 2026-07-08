'use client'

import { useState, useRef, useCallback } from 'react'

const C = '#00f0ff'
const M = '#ff1e8a'

export type ImportedTrack = { artist: string; title: string; bpm?: number; key?: string; path?: string }
type Tab = 'rekordbox' | 'traktor' | 'serato' | 'text'
interface Crate { name: string; indices: Set<number> }

interface Props {
  onImport:            (tracks: ImportedTrack[]) => void
  loading:             boolean
  setExists?:          boolean
  onLibraryDragStart?: (track: ImportedTrack) => void
  onLibraryDragEnd?:   () => void
}

// ── Music key → Camelot conversion ───────────────────────────
const NOTE_TO_CAM: Record<string, string> = {
  'Ab':'1B','G#':'1B', 'Eb':'2B','D#':'2B', 'Bb':'3B','A#':'3B', 'F':'4B',
  'C':'5B', 'G':'6B', 'D':'7B', 'A':'8B', 'E':'9B', 'B':'10B','Cb':'10B',
  'Gb':'11B','F#':'11B', 'Db':'12B','C#':'12B',
  'Abm':'1A','G#m':'1A', 'Ebm':'2A','D#m':'2A', 'Bbm':'3A','A#m':'3A', 'Fm':'4A',
  'Cm':'5A', 'Gm':'6A', 'Dm':'7A', 'Am':'8A', 'Em':'9A', 'Bm':'10A','Cbm':'10A',
  'Gbm':'11A','F#m':'11A', 'Dbm':'12A','C#m':'12A',
}
function toCam(k?: string): string | undefined {
  if (!k) return undefined
  if (/^\d+[AB]$/i.test(k.trim())) return k.trim().toUpperCase()
  return NOTE_TO_CAM[k.trim()] ?? k.trim()
}

// ── Traktor integer → Camelot ─────────────────────────────────
const TK_CAM = ['8B','9B','10B','11B','12B','1B','2B','3B','4B','5B','6B','7B',
                '8A','9A','10A','11A','12A','1A','2A','3A','4A','5A','6A','7A']

// ── Serato binary helpers ─────────────────────────────────────
const SKIP_DIRS = ['smartcrates','history','beatgrid','loops','waveforms','recording']
function sTag(b: Uint8Array, p: number) { return String.fromCharCode(b[p],b[p+1],b[p+2],b[p+3]) }
function sU32(b: Uint8Array, p: number) { return (b[p]<<24|b[p+1]<<16|b[p+2]<<8|b[p+3]) >>> 0 }
function sUTF16(b: Uint8Array, s: number, l: number) {
  let str = ''
  for (let i = 0; i < l - 1; i += 2) { const c=(b[s+i]<<8)|b[s+i+1]; if(c===0) break; str+=String.fromCharCode(c) }
  return str
}
function normP(p: string): string { try { p = decodeURIComponent(p) } catch {} return p.replace(/\\/g,'/').toLowerCase().trim() }

// ── Folder drag-and-drop (FileSystem API) ─────────────────────
async function getFilesFromDrop(dt: DataTransfer): Promise<File[]> {
  const files: File[] = []
  async function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    const all: FileSystemEntry[] = []
    while (true) { const b = await new Promise<FileSystemEntry[]>((r,j)=>reader.readEntries(r,j)); if(!b.length) break; all.push(...b) }
    return all
  }
  async function traverse(entry: FileSystemEntry, pp: string): Promise<void> {
    const ep = pp ? `${pp}/${entry.name}` : entry.name
    if (entry.isFile) {
      const file = await new Promise<File>((r,j)=>(entry as FileSystemFileEntry).file(r,j))
      try { Object.defineProperty(file,'webkitRelativePath',{value:ep}) } catch {}
      files.push(file)
    } else if (entry.isDirectory) {
      const entries = await readAll((entry as FileSystemDirectoryEntry).createReader())
      await Promise.all(entries.map(e=>traverse(e,ep)))
    }
  }
  if (dt.items?.length) {
    await Promise.all(Array.from(dt.items).map(item => {
      const e = item.webkitGetAsEntry?.(); if(e) return traverse(e,'')
      const f = item.getAsFile(); if(f) files.push(f)
      return Promise.resolve()
    }))
  } else Array.from(dt.files).forEach(f=>files.push(f))
  return files
}

// ── Rekordbox XML ─────────────────────────────────────────────
function parseRekordbox(xml: string): { tracks: ImportedTrack[]; crates: Crate[] } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const tracks: ImportedTrack[] = []
  const byId: Record<string, number> = {}
  doc.querySelectorAll('COLLECTION > TRACK').forEach(el => {
    const id = el.getAttribute('TrackID') || ''
    const bpmStr = el.getAttribute('AverageBpm')
    byId[id] = tracks.length
    tracks.push({
      artist: el.getAttribute('Artist') || 'Unknown',
      title:  el.getAttribute('Name')   || 'Unknown',
      bpm:    bpmStr ? Math.round(parseFloat(bpmStr)) : undefined,
      key:    toCam(el.getAttribute('Tonality') || undefined),
      path:   el.getAttribute('Location') || undefined,
    })
  })
  const crates: Crate[] = []
  function walk(node: Element, path = '') {
    node.querySelectorAll(':scope > NODE').forEach(child => {
      const name = child.getAttribute('Name') || 'Unnamed'
      if (name==='ROOT'||name==='root') return walk(child, path)
      const type = child.getAttribute('Type')
      const full = path ? `${path} / ${name}` : name
      if (type === '1') {
        const indices = new Set<number>()
        child.querySelectorAll('TRACK').forEach(t => { const k=t.getAttribute('Key')||''; if(k in byId) indices.add(byId[k]) })
        if (indices.size) crates.push({ name: full, indices })
      } else { walk(child, full) }
    })
  }
  const root = doc.querySelector('PLAYLISTS > NODE'); if (root) walk(root)
  return { tracks, crates }
}

// ── Traktor NML ───────────────────────────────────────────────
function parseTraktor(xml: string): { tracks: ImportedTrack[]; crates: Crate[] } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const tracks: ImportedTrack[] = []
  const byPath: Record<string, number> = {}
  doc.querySelectorAll('COLLECTION > ENTRY').forEach((el, idx) => {
    const loc = el.querySelector('LOCATION')
    const dir = loc?.getAttribute('DIR')||'', file = loc?.getAttribute('FILE')||''
    const path = `${dir.replace(/:/g,'/')}${file}`
    const tempo = el.querySelector('TEMPO'), keyEl = el.querySelector('MUSICAL_KEY')
    let title  = el.querySelector('TITLE')?.textContent?.trim()||''
    let artist = el.querySelector('ARTIST')?.textContent?.trim()||''
    if (!title && file) { const n=file.replace(/\.[^.]+$/,''),d=n.indexOf(' - '); title=d>0?n.slice(d+3):n; artist=d>0?n.slice(0,d):'Unknown' }
    const kv = keyEl?.getAttribute('VALUE'), bpmStr = tempo?.getAttribute('BPM')
    byPath[path] = idx
    tracks.push({
      artist: artist||'Unknown', title: title||'Unknown',
      bpm:    bpmStr ? Math.round(parseFloat(bpmStr)) : undefined,
      key:    kv!=null ? TK_CAM[parseInt(kv)] : undefined,
      path:   dir && file ? path : undefined,
    })
  })
  const crates: Crate[] = []
  function walk(node: Element, path = '') {
    node.querySelectorAll(':scope > NODE').forEach(child => {
      const name = child.getAttribute('NAME')||'Unnamed'
      if (name==='$ROOT'||name==='ROOT') return walk(child, path)
      const type = child.getAttribute('TYPE'), full = path ? `${path} / ${name}` : name
      if (type==='PLAYLIST') {
        const indices = new Set<number>()
        child.querySelectorAll('PLAYLIST > ENTRY > PRIMARYKEY').forEach(pk => { const k=pk.getAttribute('KEY')||''; if(k in byPath) indices.add(byPath[k]) })
        if (indices.size) crates.push({ name: full, indices })
      } else if (type==='FOLDER') { walk(child, full) }
    })
  }
  const root = doc.querySelector('PLAYLISTS > NODE'); if (root) walk(root)
  return { tracks, crates }
}

// ── Serato binary ─────────────────────────────────────────────
async function parseSerato(files: File[]): Promise<{ tracks: ImportedTrack[]; crates: Crate[] }> {
  const dbMeta: Record<string, { title?: string; artist?: string; bpm?: number; key?: string }> = {}
  const crateTrackPaths: Record<string, string[]> = {}
  const crateNames: string[] = []

  const crateFiles = files.filter(f => {
    if (!f.name.endsWith('.crate')) return false
    const rp = ((f as File & {webkitRelativePath?:string}).webkitRelativePath||'').replace(/\\/g,'/').toLowerCase()
    return !SKIP_DIRS.some(d => rp.includes(`/${d}/`) || rp.startsWith(`${d}/`))
  })
  const dbFile = files.filter(f=>f.name==='database V2')
    .sort((a,b) => ((a as File & {webkitRelativePath?:string}).webkitRelativePath||'').split('/').length - ((b as File & {webkitRelativePath?:string}).webkitRelativePath||'').split('/').length)[0]

  if (dbFile) {
    const bytes = new Uint8Array(await dbFile.arrayBuffer()); let pos = 0
    while (pos+8<=bytes.length) {
      const tag=sTag(bytes,pos), len=sU32(bytes,pos+4); pos+=8; if(pos+len>bytes.length) break
      if (tag==='otrk') {
        const t: {path?:string;title?:string;artist?:string;bpm?:number;key?:string}={}; let inner=pos
        while(inner+8<=pos+len){const it=sTag(bytes,inner),il=sU32(bytes,inner+4);inner+=8
          if(it==='pfil') t.path=sUTF16(bytes,inner,il)
          if(it==='ptrk') t.path=t.path||sUTF16(bytes,inner,il)
          if(it==='tsng') t.title=sUTF16(bytes,inner,il)
          if(it==='tart') t.artist=sUTF16(bytes,inner,il)
          if(it==='tbpm'){const s=sUTF16(bytes,inner,il),b=parseFloat(s);if(!isNaN(b)&&b>0) t.bpm=Math.round(b)}
          if(it==='tkey') t.key=sUTF16(bytes,inner,il)||undefined
          inner+=il}
        if(t.path){
          if(!t.artist&&t.title){const sep=t.title.indexOf(' - ');if(sep>0){t.artist=t.title.slice(0,sep).trim();t.title=t.title.slice(sep+3).trim()}}
          dbMeta[normP(t.path)]={...t, key:toCam(t.key)}
        }
      }
      pos+=len
    }
  }

  await Promise.all(crateFiles.map(async cf => {
    const rp = ((cf as File & {webkitRelativePath?:string}).webkitRelativePath||'').replace(/\\/g,'/')
    let key = cf.name.replace(/\.crate$/i,'')
    if (rp) {
      const parts=rp.split('/'), subIdx=parts.findIndex((p:string)=>p.toLowerCase()==='subcrates')
      if (subIdx>=0) { const rel=parts.slice(subIdx+1); key=rel.map((p:string,i:number)=>i===rel.length-1?p.replace(/\.crate$/i,''):p).join('%%') }
    }
    crateNames.push(key)
    const bytes=new Uint8Array(await cf.arrayBuffer()); const paths:string[]=[]; let pos=0
    while(pos+8<=bytes.length){const tag=sTag(bytes,pos),len=sU32(bytes,pos+4);pos+=8;if(pos+len>bytes.length)break
      if(tag==='otrk'){let inner=pos;while(inner+8<=pos+len){const it=sTag(bytes,inner),il=sU32(bytes,inner+4);inner+=8
        if(it==='ptrk'){const p=sUTF16(bytes,inner,il);if(p)paths.push(p)}inner+=il}}pos+=len}
    crateTrackPaths[key]=paths
  }))

  const tracks: ImportedTrack[] = []
  const pathToIdx: Record<string,number> = {}
  const allPaths = [...new Set(Object.values(crateTrackPaths).flat())]
  allPaths.forEach(raw => {
    const np=normP(raw); if(pathToIdx[np]!==undefined) return
    const m=dbMeta[np], fn=np.split('/').pop()||np, nm=fn.replace(/\.[^.]+$/,'').trim(), di=nm.indexOf(' - ')
    const artist=m?.artist||(di>0?nm.slice(0,di).trim():'Unknown')
    const title =m?.title ||(di>0?nm.slice(di+3).trim():nm)
    pathToIdx[np]=tracks.length
    tracks.push({ artist, title, bpm:m?.bpm, key:m?.key, path:raw })
  })

  const crates: Crate[] = []
  crateNames.sort().forEach(name => {
    const indices = new Set<number>()
    ;(crateTrackPaths[name]||[]).forEach(raw => { const idx=pathToIdx[normP(raw)]; if(idx!==undefined) indices.add(idx) })
    if (indices.size) crates.push({ name: name.split('%%').join(' / '), indices })
  })
  return { tracks, crates }
}

// ── Text parsers ──────────────────────────────────────────────
function parseM3U(content: string): ImportedTrack[] {
  const lines = content.split('\n').map(l=>l.trim()).filter(Boolean)
  const tracks: ImportedTrack[] = []
  for (let i=0;i<lines.length;i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      const m=lines[i].match(/#EXTINF:[^,]*,(.+)/); if(!m) continue
      const info=m[1].trim(), d=info.indexOf(' - ')
      tracks.push(d>0 ? {artist:info.slice(0,d).trim(),title:info.slice(d+3).trim()} : {artist:'Unknown',title:info})
    } else if (!lines[i].startsWith('#')) {
      const fn=lines[i].replace(/\\/g,'/').split('/').pop()||'', nm=fn.replace(/\.[^.]+$/,'').trim()
      if (!nm) continue; const d=nm.indexOf(' - ')
      tracks.push(d>0 ? {artist:nm.slice(0,d).trim(),title:nm.slice(d+3).trim()} : {artist:'Unknown',title:nm})
    }
  }
  return tracks
}
function parsePlain(content: string): ImportedTrack[] {
  return content.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(line => {
    const s=line.replace(/^\d+[\.\)]\s*/,'').replace(/^\d+\s*-\s*/,''), d=s.indexOf(' - ')
    return d>0 ? {artist:s.slice(0,d).trim(),title:s.slice(d+3).trim()} : {artist:'Unknown',title:s}
  })
}
function parseTextFile(filename: string, content: string): ImportedTrack[] {
  const ext=filename.split('.').pop()?.toLowerCase()
  if (ext==='m3u'||ext==='m3u8') return parseM3U(content)
  return parsePlain(content)
}

// ── Component ─────────────────────────────────────────────────
const TAB_CFG = {
  rekordbox: { label:'REKORDBOX', icon:'🎚️', accept:'.xml', hint:'rekordbox.xml',
    steps:['Open Rekordbox','File → Export Collection in xml format','Drop or select the XML file'] },
  traktor:   { label:'TRAKTOR',   icon:'🎛️', accept:'.nml', hint:'collection.nml',
    steps:['Open Traktor Pro','File → Export Collection','Drop or select the NML file'] },
  serato:    { label:'SERATO',    icon:'📂', accept:'',     hint:'_Serato_ folder',
    steps:['Close Serato first','Find ~/Music/_Serato_ (Mac) or Music/_Serato_ (Windows)','Drop or select the entire _Serato_ folder'] },
  text:      { label:'TEXT / M3U', icon:'📄', accept:'.txt,.m3u,.m3u8,.csv', hint:'tracklist or M3U file',
    steps:['Paste a tracklist below, one track per line in "Artist - Title" format','Or drop a .txt / .m3u file','Hit AI Build Set for optimal ordering and transition notes'] },
}

export default function SetlistImporter({ onImport, loading, setExists, onLibraryDragStart, onLibraryDragEnd }: Props) {
  const [tab,       setTab]       = useState<Tab>('rekordbox')
  const [tracks,    setTracks]    = useState<ImportedTrack[]>([])
  const [crates,    setCrates]    = useState<Crate[]>([])
  const [crateSel,  setCrateSel]  = useState('__all__')
  const [parsing,   setParsing]   = useState(false)
  const [parseErr,  setParseErr]  = useState<string|null>(null)
  const [dragOver,  setDragOver]  = useState(false)
  const [textInput, setTextInput] = useState('')

  const fileRef   = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const displayed = crateSel==='__all__' ? tracks
    : tracks.filter((_,i)=>crates.find(c=>c.name===crateSel)?.indices.has(i))

  function switchTab(t: Tab) { setTab(t); setTracks([]); setCrates([]); setCrateSel('__all__'); setParseErr(null); setTextInput('') }

  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setParsing(true); setParseErr(null); setTracks([]); setCrates([])
    try {
      let result: { tracks: ImportedTrack[]; crates: Crate[] }
      if (tab==='rekordbox') {
        const f=files.find(f=>f.name.endsWith('.xml'))||files[0]
        if (!f) throw new Error('No XML file found.')
        result=parseRekordbox(await f.text())
      } else if (tab==='traktor') {
        const f=files.find(f=>f.name.endsWith('.nml'))||files[0]
        if (!f) throw new Error('No NML file found.')
        result=parseTraktor(await f.text())
      } else if (tab==='serato') {
        const skip=['smartcrates','history','beatgrid','loops','waveforms','recording']
        const relevant=files.filter(f=>{
          if(f.name==='database V2') return true
          if(!f.name.endsWith('.crate')) return false
          const rp=((f as File & {webkitRelativePath?:string}).webkitRelativePath||'').replace(/\\/g,'/').toLowerCase()
          return !skip.some(d=>rp.includes(`/${d}/`)||rp.startsWith(`${d}/`))
        })
        if(!relevant.length) throw new Error('No Serato files found. Drop your _Serato_ folder.')
        result=await parseSerato(relevant)
      } else {
        // text — handled via textarea
        return
      }
      if (!result.tracks.length) throw new Error('No tracks found. Check you uploaded the correct file.')
      setTracks(result.tracks); setCrates(result.crates); setCrateSel('__all__')
    } catch (e: unknown) { setParseErr(e instanceof Error ? e.message : 'Parse failed. Please try again.') }
    finally { setParsing(false) }
  }, [tab])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const files = tab==='serato' ? await getFilesFromDrop(e.dataTransfer) : Array.from(e.dataTransfer.files)
    processFiles(files)
  }, [tab, processFiles])

  function handleTextBuild() {
    const raw = textInput.trim(); if (!raw) return
    const parsed = parsePlain(raw)
    if (!parsed.length) { setParseErr("Couldn't find any tracks. Use 'Artist - Title' format."); return }
    setParseErr(null); setTracks(parsed); setCrates([])
  }

  const cfg = TAB_CFG[tab]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <style>{`@keyframes pulse-imp{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* Format tabs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', border:'1px solid #1f1f33', borderRadius:8, overflow:'hidden' }}>
        {(Object.keys(TAB_CFG) as Tab[]).map(t => (
          <button key={t} onClick={()=>switchTab(t)}
            style={{ padding:'7px 0', border:'none', cursor:'pointer', fontSize:8.5, fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5, fontWeight:700, transition:'.15s',
              background: tab===t ? `linear-gradient(100deg,${M}22,${C}22)` : '#0d0d18',
              color:      tab===t ? C : '#6a6a8a',
              borderBottom: `2px solid ${tab===t?C:'transparent'}` }}>
            {TAB_CFG[t].label}
          </button>
        ))}
      </div>

      {/* Upload area — hide if text tab (has textarea) or tracks already loaded */}
      {tab !== 'text' && tracks.length === 0 && (
        <>
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={onDrop}
            onClick={()=>(tab==='serato'?folderRef:fileRef).current?.click()}
            style={{ border:`2px dashed ${dragOver?C:'#2a2a42'}`, borderRadius:12, padding:'22px 14px',
              textAlign:'center', cursor:'pointer', transition:'.2s',
              background:dragOver?`${C}08`:'transparent',
              boxShadow:dragOver?`0 0 20px ${C}1a`:'none' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{cfg.icon}</div>
            <div style={{ fontSize:12, fontWeight:700, color:'#e8e8f0', marginBottom:4 }}>
              Drop your {cfg.hint} here
            </div>
            <div style={{ fontSize:10, color:'#6a6a8a', marginBottom:10 }}>or click to browse</div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:`${C}14`, border:`1px solid ${C}33`, borderRadius:999, padding:'5px 14px', fontSize:10, color:C, fontFamily:"'JetBrains Mono',monospace" }}>
              ↑ Choose {tab==='serato'?'folder':'file'}
            </div>
          </div>
          <input ref={fileRef} type="file" accept={cfg.accept} style={{display:'none'}}
            onChange={e=>{if(e.target.files?.length)processFiles(Array.from(e.target.files));e.target.value=''}} />
          {/* @ts-expect-error webkitdirectory non-standard */}
          <input ref={folderRef} type="file" webkitdirectory="true" directory="true" style={{display:'none'}}
            onChange={e=>{if(e.target.files?.length)processFiles(Array.from(e.target.files));e.target.value=''}} />

          {/* Steps */}
          <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:9, color:M, letterSpacing:1, marginBottom:6, fontWeight:700 }}>HOW TO EXPORT</div>
            {cfg.steps.map((s,i)=>(
              <div key={i} style={{ display:'flex', gap:6, fontSize:10, color:'#6a6a8a', marginBottom:3, lineHeight:1.5 }}>
                <span style={{ color:C, fontWeight:700, flexShrink:0 }}>{i+1}.</span>{s}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Text tab — textarea + file drop */}
      {tab === 'text' && tracks.length === 0 && (
        <>
          <textarea value={textInput} onChange={e=>setTextInput(e.target.value)}
            placeholder={'01. Fisher — Losing It [125 BPM]\n02. Chris Lake — Turn Off The Lights\n03. Dom Dolla — San Frandisco\n…'}
            style={{ width:'100%', minHeight:140, background:'#06060c', border:'1px solid #1f1f33', color:'#e8e8f0',
              fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:'10px 12px', borderRadius:8,
              outline:'none', lineHeight:1.7, resize:'vertical', boxSizing:'border-box' }}
            onFocus={e=>{e.target.style.borderColor=C}} onBlur={e=>{e.target.style.borderColor='#1f1f33'}} />
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={handleTextBuild} disabled={!textInput.trim()}
              style={{ flex:1, padding:'10px 0', borderRadius:8, fontSize:11, fontWeight:700, cursor:textInput.trim()?'pointer':'default',
                background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none',
                fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5, opacity:textInput.trim()?1:.5 }}>
              PARSE TRACKS
            </button>
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
              onDrop={async e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(!f)return;setParsing(true);const t=await f.text();const p=parseTextFile(f.name,t);if(p.length){setTracks(p);setCrates([])}else setParseErr("Couldn't read that file.");setParsing(false)}}
              onClick={()=>fileRef.current?.click()}
              style={{ padding:'9px 14px', borderRadius:8, border:`1px dashed ${dragOver?C:'#2a2a42'}`, background:dragOver?`${C}08`:'transparent', cursor:'pointer', fontSize:10, color:C, flexShrink:0 }}>
              ↑ file
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.m3u,.m3u8,.csv" style={{display:'none'}}
            onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setParsing(true);const t=await f.text();const p=parseTextFile(f.name,t);if(p.length){setTracks(p);setCrates([])}else setParseErr("Couldn't read that file.");setParsing(false);e.target.value=''}} />
        </>
      )}

      {/* Parsing indicator */}
      {parsing && (
        <div style={{ fontSize:11, color:C, textAlign:'center', fontFamily:"'JetBrains Mono',monospace", animation:'pulse-imp 1.2s infinite' }}>
          Parsing {cfg.hint}…
        </div>
      )}

      {/* Error */}
      {parseErr && (
        <div style={{ padding:'10px 12px', border:`1px solid ${M}`, borderRadius:8, color:M, fontSize:11, lineHeight:1.5 }}>{parseErr}</div>
      )}

      {/* ── Track list ── */}
      {tracks.length > 0 && (
        <div>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#e8e8f0' }}>
              {displayed.length}<span style={{ color:'#4a4a66', fontSize:10, fontWeight:400 }}>/{tracks.length} tracks</span>
            </div>
            <button onClick={()=>{setTracks([]);setCrates([]);setCrateSel('__all__');setParseErr(null);setTextInput('')}}
              style={{ background:'transparent', border:'1px solid #23233a', color:'#6a6a8a', padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
              ✕ Clear
            </button>
          </div>

          {/* Crate selector */}
          {crates.length > 0 && (
            <select value={crateSel} onChange={e=>setCrateSel(e.target.value)}
              style={{ width:'100%', background:'#0d0d18', border:'1px solid #1f1f33', color:'#e8e8f0',
                fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'6px 10px', borderRadius:6,
                marginBottom:8, outline:'none', cursor:'pointer' }}>
              <option value="__all__">All tracks ({tracks.length})</option>
              {crates.map(c=><option key={c.name} value={c.name}>{c.name} ({c.indices.size})</option>)}
            </select>
          )}

          {/* Drag hint */}
          {setExists && onLibraryDragStart && (
            <div style={{ background:`${C}0a`, border:`1px solid ${C}28`, borderRadius:7, padding:'6px 10px',
              marginBottom:8, fontSize:10, color:C, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12 }}>⠿</span> Drag any track into your set →
            </div>
          )}

          {/* Tracks */}
          <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
            {displayed.map((t, di) => {
              const gi = tracks.indexOf(t)
              return (
                <div key={di}
                  draggable={!!onLibraryDragStart}
                  onDragStart={e=>{if(!onLibraryDragStart)return;e.dataTransfer.effectAllowed='copy';onLibraryDragStart(t)}}
                  onDragEnd={()=>onLibraryDragEnd?.()}
                  style={{ display:'flex', alignItems:'center', gap:8, background:'#0a0a14', border:'1px solid #16162a',
                    borderRadius:7, padding:'7px 10px', cursor:onLibraryDragStart?'grab':'default', transition:'.12s' }}
                  onMouseEnter={e=>{if(onLibraryDragStart)(e.currentTarget as HTMLElement).style.borderColor=`${C}44`}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='#16162a'}}>
                  {onLibraryDragStart && <div style={{ fontSize:12, color:'#2a2a48', flexShrink:0 }}>⠿</div>}
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:M, minWidth:22, flexShrink:0 }}>
                    {String(gi+1).padStart(2,'0')}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                    <div style={{ fontSize:10, color:'#6a6a8a', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{t.artist}</span>
                      {t.bpm && <span style={{ color:C, flexShrink:0 }}>{t.bpm}</span>}
                      {t.key && <span style={{ color:'#9a9ab8', flexShrink:0 }}>{t.key}</span>}
                    </div>
                  </div>
                  <button onClick={()=>setTracks(prev=>prev.filter((_,i)=>i!==gi))}
                    style={{ background:'transparent', border:'none', color:'#2a2a48', cursor:'pointer', fontSize:12, padding:'1px 4px', flexShrink:0 }}>✕</button>
                </div>
              )
            })}
          </div>

          {/* Build AI set button */}
          <button onClick={()=>onImport(displayed)} disabled={loading||!displayed.length}
            style={{ marginTop:10, width:'100%', padding:'12px 0', borderRadius:9, fontSize:11, fontWeight:700,
              background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none',
              cursor:loading||!displayed.length?'default':'pointer',
              fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5,
              opacity:loading||!displayed.length?.5:1, transition:'.2s' }}>
            {loading ? 'BUILDING SET…' : `⚡ AI-ORDER ${displayed.length} TRACKS`}
          </button>
          <div style={{ textAlign:'center', fontSize:10, color:'#3a3a58', marginTop:5 }}>
            AI adds optimal order, BPM matching, and transition notes
          </div>
        </div>
      )}
    </div>
  )
}
