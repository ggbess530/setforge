// ▸ Place at: app/components/UserLibrary.tsx
// ▸ Replaces the Import tab — persistent library that survives sessions

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const C = '#00f0ff'
const M = '#ff1e8a'

// ── Types ─────────────────────────────────────────────────────
export interface LibTrack {
  id: string; track_id?: string
  title: string; artist: string
  bpm?: number; key?: string; genre?: string; path?: string
}

interface Crate {
  id: string; crate_id?: string
  name: string; full_path?: string; fullPath?: string
  parent_id?: string; parentId?: string
  is_folder?: boolean; isFolder?: boolean
  children?: Crate[]
  trackCount?: number
}

interface Props {
  onBuildSet: (tracks: LibTrack[]) => void
  loading:    boolean
}

// ── Parsers (same as LibraryImporter) ─────────────────────────
const TRAKTOR_CAMELOT = [
  '8B','9B','10B','11B','12B','1B','2B','3B','4B','5B','6B','7B',
  '8A','9A','10A','11A','12A','1A','2A','3A','4A','5A','6A','7A',
]

function readTag(b: Uint8Array, p: number) { return String.fromCharCode(b[p],b[p+1],b[p+2],b[p+3]) }
function readU32(v: DataView, p: number)   { return v.getUint32(p, false) }
function readUTF16(b: Uint8Array, s: number, l: number) {
  let str = ''
  for (let i = 0; i < l - 1; i += 2) { const c=(b[s+i]<<8)|b[s+i+1]; if(c===0) break; str+=String.fromCharCode(c) }
  return str
}

function parseRekordbox(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const tracks: Record<string, LibTrack> = {}
  doc.querySelectorAll('COLLECTION > TRACK').forEach(el => {
    const id = el.getAttribute('TrackID') || crypto.randomUUID()
    const bpmStr = el.getAttribute('BPM')
    tracks[id] = { id, title: el.getAttribute('Name')||'Unknown', artist: el.getAttribute('Artist')||'Unknown',
      bpm: bpmStr ? Math.round(parseFloat(bpmStr)) : undefined,
      key: el.getAttribute('Tonality')||undefined, genre: el.getAttribute('Genre')||undefined,
      path: el.getAttribute('Location')||undefined }
  })
  interface FlatCrate { id:string; name:string; fullPath:string; parentId?:string; isFolder:boolean; trackIds:string[] }
  const flatCrates: FlatCrate[] = []
  function walk(node: Element, parentId?: string, parentPath = '') {
    node.querySelectorAll(':scope > NODE').forEach(child => {
      const name = child.getAttribute('Name') || 'Unnamed'
      if (name==='ROOT'||name==='root') return walk(child, parentId, parentPath)
      const type = child.getAttribute('Type')
      const fullPath = parentPath ? `${parentPath} / ${name}` : name
      const id = `rb-${fullPath}`
      if (type === '1') {
        const trackIds: string[] = []
        child.querySelectorAll('TRACK').forEach(t => { const k=t.getAttribute('Key'); if(k&&tracks[k]) trackIds.push(k) })
        flatCrates.push({ id, name, fullPath, parentId, isFolder: false, trackIds })
      } else {
        flatCrates.push({ id, name, fullPath, parentId, isFolder: true, trackIds: [] })
        walk(child, id, fullPath)
      }
    })
  }
  const root = doc.querySelector('PLAYLISTS > NODE')
  if (root) walk(root)
  return { tracks, flatCrates }
}

function parseTraktor(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const tracks: Record<string, LibTrack> = {}
  doc.querySelectorAll('COLLECTION > ENTRY').forEach((el, idx) => {
    const loc=el.querySelector('LOCATION'), tempo=el.querySelector('TEMPO'), keyEl=el.querySelector('MUSICAL_KEY')
    const dir=loc?.getAttribute('DIR')||'', file=loc?.getAttribute('FILE')||''
    const path=`${dir.replace(/:/g,'/')}${file}`, id=path||`nml-${idx}`
    let title=el.querySelector('TITLE')?.textContent?.trim()||''
    let artist=el.querySelector('ARTIST')?.textContent?.trim()||''
    if (!title && file) { const n=file.replace(/\.[^.]+$/,''),d=n.indexOf(' - '); title=d>0?n.slice(d+3):n; artist=d>0?n.slice(0,d):'Unknown' }
    const bpmStr=tempo?.getAttribute('BPM'), kv=keyEl?.getAttribute('VALUE')
    tracks[id] = { id, title:title||'Unknown', artist:artist||'Unknown',
      bpm: bpmStr ? Math.round(parseFloat(bpmStr)) : undefined,
      key: kv!=null ? TRAKTOR_CAMELOT[parseInt(kv)] : undefined,
      genre: el.querySelector('INFO')?.getAttribute('GENRE')||undefined, path }
  })
  const pathToId: Record<string,string> = {}
  Object.values(tracks).forEach(t => { if(t.path) pathToId[t.path]=t.id })
  interface FlatCrate { id:string; name:string; fullPath:string; parentId?:string; isFolder:boolean; trackIds:string[] }
  const flatCrates: FlatCrate[] = []
  function walk(node: Element, parentId?: string, parentPath = '') {
    node.querySelectorAll(':scope > NODE').forEach(child => {
      const name=child.getAttribute('NAME')||'Unnamed'
      if(name==='$ROOT'||name==='ROOT') return walk(child, parentId, parentPath)
      const type=child.getAttribute('TYPE'), fullPath=parentPath?`${parentPath} / ${name}`:name, id=`nml-${fullPath}`
      if (type==='PLAYLIST') {
        const trackIds: string[] = []
        child.querySelectorAll('PLAYLIST > ENTRY > PRIMARYKEY').forEach(pk => { const k=pk.getAttribute('KEY')||''; const tid=pathToId[k]; if(tid) trackIds.push(tid) })
        flatCrates.push({ id, name, fullPath, parentId, isFolder:false, trackIds })
      } else if (type==='FOLDER') {
        flatCrates.push({ id, name, fullPath, parentId, isFolder:true, trackIds:[] })
        walk(child, id, fullPath)
      }
    })
  }
  const root=doc.querySelector('PLAYLISTS > NODE'); if(root) walk(root)
  return { tracks, flatCrates }
}

// ── Folder drag-and-drop via FileSystem API ───────────────────
// e.dataTransfer.files returns nothing for dropped folders.
// We must walk the directory tree using webkitGetAsEntry instead.
async function getFilesFromDrop(dt: DataTransfer): Promise<File[]> {
  const files: File[] = []

  async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    const all: FileSystemEntry[] = []
    // readEntries yields at most 100 results at a time — loop until empty
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
      if (!batch.length) break
      all.push(...batch)
    }
    return all
  }

  async function traverse(entry: FileSystemEntry, parentPath: string): Promise<void> {
    const entryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej))
      // Attach relative path so downstream filters (e.g. skip SmartCrates) work correctly
      try { Object.defineProperty(file, 'webkitRelativePath', { value: entryPath }) } catch {}
      files.push(file)
    } else if (entry.isDirectory) {
      const entries = await readAllEntries((entry as FileSystemDirectoryEntry).createReader())
      await Promise.all(entries.map(e => traverse(e, entryPath)))
    }
  }

  if (dt.items?.length) {
    await Promise.all(Array.from(dt.items).map(item => {
      const entry = item.webkitGetAsEntry?.()
      if (entry) return traverse(entry, '')
      const f = item.getAsFile(); if (f) files.push(f)
      return Promise.resolve()
    }))
  } else {
    Array.from(dt.files).forEach(f => files.push(f))
  }
  return files
}

// ── Path normalisation for track lookup ───────────────────────
// database V2 can URL-encode paths; crate ptrk tags usually don't.
function normPath(p: string): string {
  try { p = decodeURIComponent(p) } catch {}
  return p.replace(/\\/g, '/').toLowerCase().trim()
}

// Derive a stable crate key from webkitRelativePath, normalising both
// old-style (%% in filename) and new-style (actual subdirectories) to
// the same Folder%%Subfolder%%Crate format.
function crateKeyFromFile(file: File): string {
  const rp = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || '').replace(/\\/g, '/')
  if (rp) {
    const parts = rp.split('/')
    const subIdx = parts.findIndex(p => p.toLowerCase() === 'subcrates')
    if (subIdx >= 0) {
      const rel = parts.slice(subIdx + 1) // everything inside Subcrates/
      return rel.map((p, i) => i === rel.length - 1 ? p.replace(/\.crate$/i, '') : p).join('%%')
    }
  }
  return file.name.replace(/\.crate$/i, '')
}

async function parseSerato(files: File[]): Promise<{ tracks: Record<string,LibTrack>; flatCrates: {id:string;name:string;fullPath:string;parentId?:string;isFolder:boolean;trackIds:string[]}[] }> {
  const tracks: Record<string,LibTrack> = {}
  const crateTrackPaths: Record<string,string[]> = {}
  const crateNames: string[] = []

  // Only process crate files from the Subcrates directory — skip SmartCrates,
  // History, BeatGrid, Loops, Waveforms which use different formats.
  const SKIP_DIRS = ['smartcrates', 'history', 'beatgrid', 'loops', 'waveforms', 'recording']
  const crateFiles = files.filter(f => {
    if (!f.name.endsWith('.crate')) return false
    const rp = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || '').replace(/\\/g, '/').toLowerCase()
    return !rp || !SKIP_DIRS.some(d => rp.includes(`/${d}/`))
  })

  // Use the database V2 closest to the root (fewest path segments).
  const dbCandidates = files.filter(f => f.name === 'database V2')
  const dbFile = dbCandidates.sort((a, b) => {
    const ra = ((a as any).webkitRelativePath || '').split('/').length
    const rb = ((b as any).webkitRelativePath || '').split('/').length
    return ra - rb
  })[0]
  const dbMeta: Record<string,Partial<LibTrack>> = {}

  if (dbFile) {
    const buf=await new Promise<ArrayBuffer>((res,rej)=>{ const r=new FileReader(); r.onload=e=>res(e.target?.result as ArrayBuffer); r.onerror=rej; r.readAsArrayBuffer(dbFile) })
    const bytes=new Uint8Array(buf), view=new DataView(buf)
    let pos=0
    while (pos+8<=bytes.length) {
      const tag=readTag(bytes,pos), len=readU32(view,pos+4); pos+=8; if(pos+len>bytes.length) break
      if (tag==='otrk') {
        const t: Partial<LibTrack>&{path?:string}={};let inner=pos
        while(inner+8<=pos+len){const it=readTag(bytes,inner),il=readU32(view,inner+4);inner+=8
          if(it==='pfil') t.path=readUTF16(bytes,inner,il)   // database V2 uses pfil, not ptrk
          if(it==='ptrk') t.path=t.path||readUTF16(bytes,inner,il) // older format fallback
          if(it==='tsng') t.title=readUTF16(bytes,inner,il)
          if(it==='tart') t.artist=readUTF16(bytes,inner,il)
          if(it==='tgen') t.genre=readUTF16(bytes,inner,il)
          if(it==='tkey') t.key=readUTF16(bytes,inner,il)||undefined
          if(it==='tbpm'){const s=readUTF16(bytes,inner,il),b=parseFloat(s);if(!isNaN(b)&&b>0) t.bpm=Math.round(b)}
          inner+=il}
        if(t.path){
          // Some Serato versions store "Artist - Title" combined in tsng with no tart tag
          if(!t.artist&&t.title){const sep=t.title.indexOf(' - ');if(sep>0){t.artist=t.title.slice(0,sep).trim();t.title=t.title.slice(sep+3).trim()}}
          const n=normPath(t.path);dbMeta[n]={...t,id:n}
        }
      }
      pos+=len
    }
  }

  await Promise.all(crateFiles.map(async file => {
    const key = crateKeyFromFile(file); crateNames.push(key)
    const buf=await new Promise<ArrayBuffer>((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target?.result as ArrayBuffer);r.onerror=rej;r.readAsArrayBuffer(file)})
    const bytes=new Uint8Array(buf),view=new DataView(buf); const paths: string[]=[]; let pos=0
    while(pos+8<=bytes.length){const tag=readTag(bytes,pos),len=readU32(view,pos+4);pos+=8;if(pos+len>bytes.length)break
      if(tag==='otrk'){let inner=pos;while(inner+8<=pos+len){const it=readTag(bytes,inner),il=readU32(view,inner+4);inner+=8
        if(it==='ptrk'){const p=readUTF16(bytes,inner,il);if(p)paths.push(p)}
        inner+=il}}pos+=len}
    crateTrackPaths[key]=paths
    paths.forEach(raw=>{
      const np=normPath(raw), id=np
      const m=dbMeta[np]
      if(!tracks[id]){
        const fn=np.split('/').pop()||np, nm=fn.replace(/\.[^.]+$/,'').trim(), di=nm.indexOf(' - ')
        const artist=di>0?nm.slice(0,di).trim():'Unknown', title=di>0?nm.slice(di+3).trim():nm
        tracks[id]={id,title:m?.title||title,artist:m?.artist||artist,bpm:m?.bpm,key:m?.key,genre:m?.genre,path:raw}
      }
    })
  }))

  // Build flat crates from %% separator names
  interface FlatCrate{id:string;name:string;fullPath:string;parentId?:string;isFolder:boolean;trackIds:string[]}
  const flatCrates: FlatCrate[] = []
  const pathToId: Record<string,string>={}
  Object.values(tracks).forEach(t=>{if(t.path)pathToId[normPath(t.path)]=t.id})
  const crateMap: Record<string,FlatCrate>={}
  crateNames.sort().forEach(key=>{
    const parts=key.split('%%')
    parts.forEach((_,i)=>{
      const segKey=parts.slice(0,i+1).join('%%')
      if(crateMap[segKey]) return
      const name=parts[i], parentKey=i>0?parts.slice(0,i).join('%%'):undefined
      const fullPath=parts.slice(0,i+1).join(' / '), id=`serato-${segKey}`
      const isFolder=crateNames.some(k=>k!==segKey&&k.startsWith(segKey+'%%'))
      const rawPaths=i===parts.length-1?(crateTrackPaths[key]||[]):[]
      const trackIds=rawPaths.map(p=>pathToId[normPath(p)]||p).filter(id=>tracks[id])
      const fc: FlatCrate={id,name,fullPath,parentId:parentKey?`serato-${parentKey}`:undefined,isFolder,trackIds}
      crateMap[segKey]=fc; flatCrates.push(fc)
    })
  })
  return { tracks, flatCrates }
}

// ── Build tree from flat list ──────────────────────────────────
function buildTree(flatCrates: Crate[]): Crate[] {
  const map: Record<string,Crate> = {}
  flatCrates.forEach(c => { map[c.id||c.crate_id||''] = { ...c, children: [] } })
  const roots: Crate[] = []
  flatCrates.forEach(c => {
    const node = map[c.id||c.crate_id||'']
    const parentId = c.parent_id || (c as {parentId?:string}).parentId
    if (parentId && map[parentId]) map[parentId].children!.push(node)
    else roots.push(node)
  })
  return roots
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════
export default function UserLibrary({ onBuildSet, loading }: Props) {
  const [libraryMeta, setLibraryMeta]   = useState<{ trackCount:number; crates:Crate[] }|null>(null)
  const [loadingLib,  setLoadingLib]    = useState(true)
  const [selectedId,  setSelectedId]    = useState<string|null>(null)
  const [expanded,    setExpanded]      = useState<Set<string>>(new Set())
  const [uploading,   setUploading]     = useState(false)
  const [uploadMsg,   setUploadMsg]     = useState<string|null>(null)
  const [uploadErr,   setUploadErr]     = useState<string|null>(null)
  const [showUpload,  setShowUpload]    = useState(false)
  const [uploadTab,   setUploadTab]     = useState<'rekordbox'|'traktor'|'serato'>('rekordbox')
  const [dragOver,    setDragOver]      = useState(false)
  const [clearing,    setClearing]      = useState(false)
  const [confirmClear,setConfirmClear]  = useState(false)
  const [trackCount,  setTrackCount]    = useState(0)

  const fileRef   = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  // ── Load library metadata on mount ───────────────────────────
  useEffect(() => { fetchLibraryMeta() }, [])

  async function fetchLibraryMeta() {
    setLoadingLib(true)
    try {
      const res  = await fetch('/api/user-library')
      const data = await res.json()
      if (res.ok) {
        setLibraryMeta({ trackCount: data.trackCount, crates: data.crates || [] })
        setTrackCount(data.trackCount || 0)
        // Auto-expand top folders
        const topFolders = (data.crates || []).filter((c: Crate) => c.is_folder && !c.parent_id).slice(0,3)
        setExpanded(new Set(topFolders.map((c: Crate) => c.crate_id || c.id)))
      }
    } catch {}
    finally { setLoadingLib(false) }
  }

  // ── Build set from selected crate ────────────────────────────
  async function buildFromCrate() {
    const crateId = selectedId || '__all__'
    try {
      const res  = await fetch(`/api/user-library?crateId=${crateId}`)
      const data = await res.json()
      if (!res.ok || !data.tracks?.length) {
        setUploadErr('No tracks found in this crate.'); return
      }
      const tracks: LibTrack[] = data.tracks.map((t: {track_id:string;title:string;artist:string;bpm?:number;key?:string;genre?:string;path?:string}) => ({
        id: t.track_id, title: t.title, artist: t.artist,
        bpm: t.bpm, key: t.key, genre: t.genre, path: t.path,
      }))
      onBuildSet(tracks)
    } catch { setUploadErr('Failed to load tracks. Please try again.') }
  }

  // ── Save parsed library to Supabase ──────────────────────────
  async function saveLibrary(
    source: string,
    tracks: Record<string, LibTrack>,
    flatCrates: { id:string; name:string; fullPath:string; parentId?:string; isFolder:boolean; trackIds:string[] }[],
  ) {
    const trackArr = Object.values(tracks)
    const crateArr = flatCrates.map(c => ({
      id: c.id, name: c.name, fullPath: c.fullPath,
      parentId: c.parentId, isFolder: c.isFolder,
    }))
    const crateTracks: Record<string,string[]> = {}
    flatCrates.forEach(c => { if (c.trackIds.length) crateTracks[c.id] = c.trackIds })

    const res = await fetch('/api/user-library', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, tracks: trackArr, crates: crateArr, crateTracks }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Save failed')
    return data
  }

  // ── Handle file upload ────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    setUploading(true); setUploadErr(null); setUploadMsg('Parsing library…')
    try {
      let tracks: Record<string, LibTrack>
      let flatCrates: { id:string; name:string; fullPath:string; parentId?:string; isFolder:boolean; trackIds:string[] }[]

      const readText = (file: File) => new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target?.result as string);r.onerror=rej;r.readAsText(file)})

      if (uploadTab === 'rekordbox') {
        const f = arr.find(f=>f.name.endsWith('.xml'))||arr[0]
        if (!f) throw new Error('No XML file found.')
        const parsed = parseRekordbox(await readText(f))
        tracks = parsed.tracks; flatCrates = parsed.flatCrates
      } else if (uploadTab === 'traktor') {
        const f = arr.find(f=>f.name.endsWith('.nml'))||arr[0]
        if (!f) throw new Error('No NML file found.')
        const parsed = parseTraktor(await readText(f))
        tracks = parsed.tracks; flatCrates = parsed.flatCrates
      } else {
        // Accept the full _Serato_ folder, the Subcrates subfolder, or individual files.
        const SKIP = ['smartcrates', 'history', 'beatgrid', 'loops', 'waveforms', 'recording']
        const relevant = arr.filter(f => {
          if (f.name === 'database V2') return true
          if (!f.name.endsWith('.crate')) return false
          const rp = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || '').replace(/\\/g, '/').toLowerCase()
          return !rp || !SKIP.some(d => rp.includes(`/${d}/`))
        })
        if (!relevant.length) throw new Error('No Serato files found. Upload your _Serato_ folder.')
        const parsed = await parseSerato(relevant)
        tracks = parsed.tracks; flatCrates = parsed.flatCrates
      }

      const trackCount = Object.keys(tracks).length
      if (trackCount === 0) throw new Error('No tracks found. Check you exported the right format.')

      setUploadMsg(`Found ${trackCount.toLocaleString()} tracks. Saving to your library…`)
      const result = await saveLibrary(uploadTab, tracks, flatCrates)
      setUploadMsg(`✓ Saved ${result.trackCount.toLocaleString()} tracks and ${result.crateCount} crates`)
      setShowUpload(false)
      await fetchLibraryMeta()
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed.')
      setUploadMsg(null)
    } finally { setUploading(false) }
  }, [uploadTab])

  // ── Clear library ─────────────────────────────────────────────
  async function clearLibrary() {
    setClearing(true)
    try {
      await fetch('/api/user-library', { method: 'DELETE' })
      setLibraryMeta(null); setTrackCount(0); setSelectedId(null); setConfirmClear(false)
    } catch {}
    finally { setClearing(false) }
  }

  // ── Crate tree ────────────────────────────────────────────────
  function toggleExpand(id: string) {
    setExpanded(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  }

  function CrateNode({ crate, depth }: { crate: Crate; depth: number }) {
    const id       = crate.crate_id || crate.id
    const isFolder = crate.is_folder || (crate as {isFolder?:boolean}).isFolder
    const isSelected = selectedId === id
    const isExpanded = expanded.has(id)

    return (
      <div>
        <div onClick={() => isFolder ? toggleExpand(id) : setSelectedId(id)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:`5px 10px 5px ${12+depth*14}px`, cursor:'pointer',
            background: isSelected?`${C}14`:'transparent', borderLeft:`2px solid ${isSelected?C:'transparent'}`,
            borderRadius:4, transition:'.12s', fontSize:12 }}
          onMouseEnter={e=>{if(!isSelected)(e.currentTarget as HTMLElement).style.background='#0d0d1a'}}
          onMouseLeave={e=>{if(!isSelected)(e.currentTarget as HTMLElement).style.background='transparent'}}>
          <span style={{ fontSize:10, flexShrink:0, color:isFolder?'#f59e0b':'#6a6a8a', display:'inline-block', transition:'.15s', transform:isFolder&&isExpanded?'rotate(90deg)':'none' }}>
            {isFolder?'▶':'♪'}
          </span>
          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:isSelected?C:'#c8c8e0' }}>
            {crate.name}
          </span>
          {crate.trackCount !== undefined && crate.trackCount > 0 && (
            <span style={{ fontSize:9, color:'#4a4a66', flexShrink:0 }}>{crate.trackCount}</span>
          )}
        </div>
        {isFolder && isExpanded && (crate.children||[]).map(child=>(
          <CrateNode key={child.crate_id||child.id} crate={child} depth={depth+1} />
        ))}
      </div>
    )
  }

  const tree = libraryMeta ? buildTree(libraryMeta.crates) : []

  // ── Upload panel ──────────────────────────────────────────────
  const INST = {
    rekordbox: { steps:['Open Rekordbox','File → Export Collection in xml format','Upload the XML file'], accept:'.xml' },
    traktor:   { steps:['Open Traktor Pro','File → Export Collection','Upload the .nml file'], accept:'.nml' },
    serato:    { steps:['Close Serato DJ first','Find your _Serato_ folder — ~/Music/_Serato_ on Mac, or Music/_Serato_ on Windows','Upload the entire _Serato_ folder (crates and track data are found automatically)'], accept:'' },
  }

  if (showUpload) return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#e8e8f0' }}>Add to Library</div>
        <button onClick={()=>{setShowUpload(false);setUploadErr(null);setUploadMsg(null)}} style={{ background:'none', border:'none', color:'#4a4a66', cursor:'pointer', fontSize:13 }}>✕</button>
      </div>

      {/* Format tabs */}
      <div style={{ display:'flex', border:'1px solid #1f1f33', borderRadius:8, overflow:'hidden' }}>
        {(['rekordbox','traktor','serato'] as const).map(t=>(
          <button key={t} onClick={()=>setUploadTab(t)}
            style={{ flex:1, padding:'7px 0', border:'none', cursor:'pointer', fontSize:9, fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5, fontWeight:600, transition:'.15s',
              background:uploadTab===t?`linear-gradient(100deg,${M}22,${C}22)`:'#0d0d18',
              color:uploadTab===t?C:'#6a6a8a', borderBottom:`2px solid ${uploadTab===t?C:'transparent'}` }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
        onDrop={async e=>{e.preventDefault();setDragOver(false);handleFiles(await getFilesFromDrop(e.dataTransfer))}}
        onClick={()=>uploadTab==='serato'?folderRef.current?.click():fileRef.current?.click()}
        style={{ border:`2px dashed ${dragOver?C:'#2a2a42'}`, borderRadius:10, padding:'24px 14px', textAlign:'center', cursor:'pointer', transition:'.2s', background:dragOver?`${C}06`:'transparent' }}>
        <div style={{ fontSize:28, marginBottom:6 }}>{uploadTab==='serato'?'📂':uploadTab==='rekordbox'?'🎚️':'🎛️'}</div>
        <div style={{ fontSize:12, color:'#e8e8f0', fontWeight:600, marginBottom:4 }}>
          Drop your {uploadTab === 'serato' ? '_Serato_ folder' : INST[uploadTab].accept || 'file'} here
        </div>
        <div style={{ fontSize:10, color:'#6a6a8a' }}>or click to browse</div>
      </div>

      <input ref={fileRef} type="file" accept={INST[uploadTab].accept} style={{ display:'none' }}
        onChange={e=>{if(e.target.files?.length)handleFiles(e.target.files)}} />
      <input ref={folderRef} type="file" style={{ display:'none' }}
        // @ts-expect-error non-standard
        webkitdirectory="true" directory="true"
        onChange={e=>{if(e.target.files?.length)handleFiles(e.target.files)}} />

      {/* Instructions */}
      <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:8, padding:'10px 12px' }}>
        <div style={{ fontSize:9, color:M, letterSpacing:1, marginBottom:6, fontWeight:600 }}>HOW TO EXPORT</div>
        {INST[uploadTab].steps.map((s,i)=>(
          <div key={i} style={{ display:'flex', gap:7, fontSize:11, color:'#6a6a8a', marginBottom:4, lineHeight:1.5 }}>
            <span style={{ color:C, fontWeight:700, flexShrink:0 }}>{i+1}.</span>{s}
          </div>
        ))}
      </div>

      {uploading && <div style={{ fontSize:11, color:C, textAlign:'center', animation:'pulse 1.2s infinite' }}>{uploadMsg}</div>}
      {uploadMsg && !uploading && <div style={{ fontSize:11, color:'#4ade80', textAlign:'center' }}>{uploadMsg}</div>}
      {uploadErr && <div style={{ padding:10, border:`1px solid ${M}`, borderRadius:8, color:M, fontSize:11, lineHeight:1.5 }}>{uploadErr}</div>}
    </div>
  )

  // ── Empty library state ───────────────────────────────────────
  if (!loadingLib && (!libraryMeta || trackCount === 0)) return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ textAlign:'center', padding:'28px 16px', background:'#06060c', border:'1px solid #1a1a2e', borderRadius:12 }}>
        <div style={{ fontSize:36, marginBottom:10, opacity:.3 }}>🎵</div>
        <div style={{ fontSize:13, fontWeight:600, color:'#6a6a8a', marginBottom:6 }}>No library yet</div>
        <div style={{ fontSize:11, color:'#4a4a66', lineHeight:1.6, marginBottom:16 }}>
          Import your Rekordbox, Traktor, or Serato library once — then build sets from your own tracks any time.
        </div>
        <button onClick={()=>{setShowUpload(true);setUploadErr(null);setUploadMsg(null)}}
          style={{ background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none', padding:'10px 22px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:1 }}>
          ↑ IMPORT LIBRARY
        </button>
      </div>
    </div>
  )

  // ── Library browser ───────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Library header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#0a0a14', border:'1px solid #1f1f33', borderRadius:8, padding:'8px 12px' }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#e8e8f0' }}>Your Library</div>
          <div style={{ fontSize:10, color:'#6a6a8a' }}>{loadingLib ? '…' : `${trackCount.toLocaleString()} tracks`}</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>{setShowUpload(true);setUploadErr(null);setUploadMsg(null)}}
            style={{ background:`${C}18`, border:`1px solid ${C}44`, color:C, padding:'4px 10px', borderRadius:6, fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>
            + ADD
          </button>
          <button onClick={()=>setConfirmClear(true)}
            style={{ background:'transparent', border:'1px solid #23233a', color:'#5a5a78', padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
            ✕
          </button>
        </div>
      </div>

      {/* Confirm clear */}
      {confirmClear && (
        <div style={{ background:'#1a0a0e', border:`1px solid ${M}44`, borderRadius:8, padding:'10px 12px', fontSize:11 }}>
          <div style={{ color:M, fontWeight:700, marginBottom:8 }}>Clear entire library?</div>
          <div style={{ color:'#9a9ab8', marginBottom:10, lineHeight:1.5 }}>This removes all your saved tracks and crates. Your SetForge sets are unaffected.</div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={clearLibrary} disabled={clearing} style={{ background:M, color:'#06060c', border:'none', padding:'6px 14px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>
              {clearing?'Clearing…':'YES, CLEAR'}
            </button>
            <button onClick={()=>setConfirmClear(false)} style={{ background:'transparent', border:'1px solid #23233a', color:'#8a8aa8', padding:'6px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Crate browser */}
      <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:10, overflow:'hidden' }}>
        <div style={{ padding:'7px 12px 5px', fontSize:9, letterSpacing:2, color:'#4a4a66', borderBottom:'1px solid #1a1a2e' }}>CRATE BROWSER</div>

        {/* All tracks */}
        <div onClick={()=>setSelectedId('__all__')}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', cursor:'pointer', background:!selectedId||selectedId==='__all__'?`${C}14`:'transparent', borderLeft:`2px solid ${!selectedId||selectedId==='__all__'?C:'transparent'}`, margin:'4px 4px 2px', borderRadius:4, transition:'.12s' }}>
          <span style={{ fontSize:10, color:'#9a9ab8' }}>⊞</span>
          <span style={{ flex:1, fontSize:12, color:!selectedId||selectedId==='__all__'?C:'#c8c8e0' }}>All Tracks</span>
          <span style={{ fontSize:9, color:'#4a4a66' }}>{trackCount}</span>
        </div>

        {/* Tree */}
        <div style={{ maxHeight:260, overflowY:'auto', padding:4 }}>
          {loadingLib ? (
            <div style={{ padding:'16px', fontSize:10, color:'#4a4a66', textAlign:'center', animation:'pulse 1.2s infinite' }}>Loading crates…</div>
          ) : tree.length === 0 ? (
            <div style={{ padding:'12px', fontSize:10, color:'#4a4a66', textAlign:'center' }}>No crates in library</div>
          ) : (
            tree.map(c=><CrateNode key={c.crate_id||c.id} crate={c} depth={0} />)
          )}
        </div>
      </div>

      {/* Build set button */}
      <button onClick={buildFromCrate} disabled={loading || loadingLib || trackCount === 0}
        style={{ background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none', padding:'12px 0', borderRadius:10, fontSize:12, fontWeight:700, cursor:loading||loadingLib||trackCount===0?'default':'pointer', fontFamily:"'JetBrains Mono',monospace", letterSpacing:1, opacity:loading||loadingLib||trackCount===0?.5:1, transition:'.2s' }}>
        {loading ? 'BUILDING SET…' : selectedId && selectedId !== '__all__' ? '⚡ BUILD SET FROM CRATE' : `⚡ BUILD SET FROM LIBRARY`}
      </button>

      <div style={{ fontSize:10, color:'#3a3a58', textAlign:'center', lineHeight:1.5 }}>
        AI selects the best tracks from your crate and builds an optimally ordered set
      </div>
    </div>
  )
}
