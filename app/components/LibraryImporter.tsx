// ▸ Place at: app/components/LibraryImporter.tsx

'use client'

import { useState, useRef, useCallback } from 'react'

const C = '#00f0ff'
const M = '#ff1e8a'

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface LibTrack {
  id:      string
  title:   string
  artist:  string
  bpm?:    number
  key?:    string   // Camelot format: "8A", "3B"
  genre?:  string
  path?:   string
}

interface Crate {
  id:       string
  name:     string
  fullPath: string
  trackIds: string[]
  children: Crate[]
  isFolder: boolean
}

interface Library {
  source:      'rekordbox' | 'traktor' | 'serato'
  filename:    string
  tracks:      Record<string, LibTrack>
  crates:      Crate[]
  totalTracks: number
}

interface Props {
  onBuildSet: (tracks: LibTrack[]) => void
  loading:    boolean
}

// ══════════════════════════════════════════════════════════════
// PARSER UTILITIES
// ══════════════════════════════════════════════════════════════

function readFileAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = e => res(e.target?.result as string)
    r.onerror = rej
    r.readAsText(file, 'utf-8')
  })
}

function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = e => res(e.target?.result as ArrayBuffer)
    r.onerror = rej
    r.readAsArrayBuffer(file)
  })
}

// ══════════════════════════════════════════════════════════════
// REKORDBOX XML PARSER
// ══════════════════════════════════════════════════════════════

function parseRekordbox(xml: string, filename: string): Library {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const tracks: Record<string, LibTrack> = {}

  // Parse all tracks from COLLECTION
  doc.querySelectorAll('COLLECTION > TRACK').forEach(el => {
    const id     = el.getAttribute('TrackID') || crypto.randomUUID()
    const bpmStr = el.getAttribute('BPM')
    const bpm    = bpmStr ? Math.round(parseFloat(bpmStr)) : undefined
    tracks[id] = {
      id,
      title:  el.getAttribute('Name')     || 'Unknown',
      artist: el.getAttribute('Artist')   || 'Unknown',
      bpm:    bpm    || undefined,
      key:    el.getAttribute('Tonality') || undefined,
      genre:  el.getAttribute('Genre')    || undefined,
      path:   el.getAttribute('Location') || undefined,
    }
  })

  // Recursively parse playlist/folder NODE hierarchy
  function parseNode(node: Element, parentPath = ''): Crate[] {
    const crates: Crate[] = []
    node.querySelectorAll(':scope > NODE').forEach(child => {
      const name     = child.getAttribute('Name') || 'Unnamed'
      if (name === 'ROOT' || name === 'root') return
      const type     = child.getAttribute('Type')
      const fullPath = parentPath ? `${parentPath} / ${name}` : name
      const id       = `rb-${fullPath}`

      if (type === '1') {
        // Playlist leaf
        const trackIds: string[] = []
        child.querySelectorAll('TRACK').forEach(t => {
          const key = t.getAttribute('Key')
          if (key && tracks[key]) trackIds.push(key)
        })
        crates.push({ id, name, fullPath, trackIds, children: [], isFolder: false })
      } else {
        // Folder node
        const children = parseNode(child, fullPath)
        crates.push({ id, name, fullPath, trackIds: [], children, isFolder: true })
      }
    })
    return crates
  }

  const root   = doc.querySelector('PLAYLISTS > NODE')
  const crates = root ? parseNode(root) : []

  return { source: 'rekordbox', filename, tracks, crates, totalTracks: Object.keys(tracks).length }
}

// ══════════════════════════════════════════════════════════════
// TRAKTOR NML PARSER
// ══════════════════════════════════════════════════════════════

// Traktor key integers (0-23) → Camelot notation
const TRAKTOR_TO_CAMELOT = [
  '8B','9B','10B','11B','12B','1B','2B','3B','4B','5B','6B','7B',
  '8A','9A','10A','11A','12A','1A','2A','3A','4A','5A','6A','7A',
]

function parseTraktor(xml: string, filename: string): Library {
  const doc    = new DOMParser().parseFromString(xml, 'text/xml')
  const tracks: Record<string, LibTrack> = {}

  doc.querySelectorAll('COLLECTION > ENTRY').forEach((el, idx) => {
    const loc   = el.querySelector('LOCATION')
    const tempo = el.querySelector('TEMPO')
    const keyEl = el.querySelector('MUSICAL_KEY')

    const dir  = loc?.getAttribute('DIR')  || ''
    const file = loc?.getAttribute('FILE') || ''
    // Traktor stores dirs with colons: /Music/:Tech House:  → clean it
    const cleanDir = dir.replace(/:/g, '/')
    const path = `${cleanDir}${file}`
    const id   = path || `traktor-${idx}`

    let title  = el.querySelector('TITLE')?.textContent?.trim()  || ''
    let artist = el.querySelector('ARTIST')?.textContent?.trim() || ''

    if (!title && file) {
      const name    = file.replace(/\.[^.]+$/, '')
      const dIdx    = name.indexOf(' - ')
      title  = dIdx > 0 ? name.slice(dIdx + 3).trim() : name
      artist = dIdx > 0 ? name.slice(0, dIdx).trim()  : 'Unknown'
    }

    const bpmStr = tempo?.getAttribute('BPM')
    const bpm    = bpmStr ? Math.round(parseFloat(bpmStr)) : undefined
    const kv     = keyEl?.getAttribute('VALUE')
    const key    = kv !== null && kv !== undefined ? TRAKTOR_TO_CAMELOT[parseInt(kv)] : undefined
    const genre  = el.querySelector('INFO')?.getAttribute('GENRE') || undefined

    tracks[id] = { id, title: title || 'Unknown', artist: artist || 'Unknown', bpm, key, genre, path }
  })

  // Build path → id map for playlist resolution
  const pathToId: Record<string, string> = {}
  Object.values(tracks).forEach(t => { if (t.path) pathToId[t.path] = t.id })

  function parseNode(node: Element, parentPath = ''): Crate[] {
    const crates: Crate[] = []
    node.querySelectorAll(':scope > NODE').forEach(child => {
      const name     = child.getAttribute('NAME') || 'Unnamed'
      if (name === '$ROOT' || name === 'ROOT') return
      const type     = child.getAttribute('TYPE')
      const fullPath = parentPath ? `${parentPath} / ${name}` : name
      const id       = `nml-${fullPath}`

      if (type === 'PLAYLIST') {
        const trackIds: string[] = []
        child.querySelectorAll('PLAYLIST > ENTRY > PRIMARYKEY').forEach(pk => {
          const key = pk.getAttribute('KEY') || ''
          // Traktor path keys use colons — normalise for lookup
          const normKey = key.replace(/:\//g, '/').replace(/:/g, '/')
          const tid = pathToId[key] || pathToId[normKey]
          if (tid) trackIds.push(tid)
        })
        crates.push({ id, name, fullPath, trackIds, children: [], isFolder: false })
      } else if (type === 'FOLDER') {
        const children = parseNode(child, fullPath)
        crates.push({ id, name, fullPath, trackIds: [], children, isFolder: true })
      }
    })
    return crates
  }

  const root   = doc.querySelector('PLAYLISTS > NODE')
  const crates = root ? parseNode(root) : []

  return { source: 'traktor', filename, tracks, crates, totalTracks: Object.keys(tracks).length }
}

// ══════════════════════════════════════════════════════════════
// SERATO BINARY PARSER
// ══════════════════════════════════════════════════════════════

function readTag(bytes: Uint8Array, pos: number): string {
  return String.fromCharCode(bytes[pos], bytes[pos+1], bytes[pos+2], bytes[pos+3])
}

function readU32(view: DataView, pos: number): number {
  return view.getUint32(pos, false)  // big-endian
}

// Serato paths/strings are UTF-16 BE
function readUTF16(bytes: Uint8Array, start: number, length: number): string {
  let str = ''
  for (let i = 0; i < length - 1; i += 2) {
    const code = (bytes[start + i] << 8) | bytes[start + i + 1]
    if (code === 0) break
    str += String.fromCharCode(code)
  }
  return str
}

// Parse a .crate file — returns array of file paths
function parseSeratoCrate(buf: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buf)
  const view  = new DataView(buf)
  const paths: string[] = []
  let pos = 0

  while (pos + 8 <= bytes.length) {
    const tag = readTag(bytes, pos)
    const len = readU32(view, pos + 4)
    pos += 8
    if (pos + len > bytes.length) break

    if (tag === 'otrk') {
      // Track record — read inner frames
      let inner = pos
      while (inner + 8 <= pos + len) {
        const itag = readTag(bytes, inner)
        const ilen = readU32(view, inner + 4)
        inner += 8
        if (itag === 'ptrk') {
          const path = readUTF16(bytes, inner, ilen)
          if (path) paths.push(path)
        }
        inner += ilen
      }
    }
    pos += len
  }
  return paths
}

// Parse Serato database V2 — returns metadata keyed by file path
function parseSeratoDatabase(buf: ArrayBuffer): Record<string, Partial<LibTrack>> {
  const bytes   = new Uint8Array(buf)
  const view    = new DataView(buf)
  const result: Record<string, Partial<LibTrack>> = {}
  let pos = 0

  while (pos + 8 <= bytes.length) {
    const tag = readTag(bytes, pos)
    const len = readU32(view, pos + 4)
    pos += 8
    if (pos + len > bytes.length) break

    if (tag === 'otrk') {
      const t: Partial<LibTrack> & { path?: string } = {}
      let inner = pos

      while (inner + 8 <= pos + len) {
        const itag = readTag(bytes, inner)
        const ilen = readU32(view, inner + 4)
        inner += 8

        switch (itag) {
          case 'ptrk': t.path   = readUTF16(bytes, inner, ilen); break
          case 'tsng': t.title  = readUTF16(bytes, inner, ilen); break
          case 'tart': t.artist = readUTF16(bytes, inner, ilen); break
          case 'tgen': t.genre  = readUTF16(bytes, inner, ilen); break
          case 'tbpm': {
            const bpmStr = readUTF16(bytes, inner, ilen)
            const bpm    = parseFloat(bpmStr)
            if (!isNaN(bpm) && bpm > 0) t.bpm = Math.round(bpm)
            break
          }
        }
        inner += ilen
      }

      if (t.path) {
        const norm = t.path.replace(/\\/g, '/')
        result[norm] = { ...t, id: norm }
      }
    }
    pos += len
  }
  return result
}

function trackFromPath(path: string): { artist: string; title: string } {
  const filename = path.replace(/\\/g, '/').split('/').pop() || path
  const name     = filename.replace(/\.[^.]+$/, '').trim()
  const dIdx     = name.indexOf(' - ')
  return dIdx > 0
    ? { artist: name.slice(0, dIdx).trim(), title: name.slice(dIdx + 3).trim() }
    : { artist: 'Unknown', title: name }
}

// Build Serato crate tree from flat crate names (using %% separator)
function buildSeratoCrateTree(
  crateNames: string[],
  crateTrackPaths: Record<string, string[]>,
  tracks: Record<string, LibTrack>
): Crate[] {
  // Map path → trackId
  const pathToId: Record<string, string> = {}
  Object.values(tracks).forEach(t => { if (t.path) pathToId[t.path.replace(/\\/g, '/')] = t.id })

  interface TreeNode { name: string; children: Record<string, TreeNode>; crateKey: string }
  const root: Record<string, TreeNode> = {}

  crateNames.forEach(key => {
    const parts = key.split('%%')
    let cur = root
    parts.forEach((part, i) => {
      if (!cur[part]) cur[part] = { name: part, children: {}, crateKey: parts.slice(0, i+1).join('%%') }
      cur = cur[part].children
    })
  })

  function nodeToCrate(node: TreeNode, parentPath = ''): Crate {
    const fullPath = parentPath ? `${parentPath} / ${node.name}` : node.name
    const id       = `serato-${node.crateKey}`
    const rawPaths = crateTrackPaths[node.crateKey] || []
    const trackIds = rawPaths.map(p => pathToId[p.replace(/\\/g, '/')] || p).filter(id => tracks[id])
    const children = Object.values(node.children).map(child => nodeToCrate(child, fullPath))
    const isFolder = children.length > 0 && rawPaths.length === 0
    return { id, name: node.name, fullPath, trackIds, children, isFolder }
  }

  return Object.values(root).map(node => nodeToCrate(node))
}

// Parse all Serato files from a folder upload
async function parseSerato(files: File[]): Promise<Library> {
  const tracks: Record<string, LibTrack> = {}
  const crateTrackPaths: Record<string, string[]> = {}
  let dbMeta: Record<string, Partial<LibTrack>> = {}
  const crateNames: string[] = []

  // Separate database V2 from crate files
  const dbFile     = files.find(f => f.name === 'database V2')
  const crateFiles = files.filter(f => f.name.endsWith('.crate'))

  // Parse database V2 for metadata
  if (dbFile) {
    try {
      const buf = await readFileAsBuffer(dbFile)
      dbMeta    = parseSeratoDatabase(buf)
    } catch (e) { console.warn('Could not parse Serato database V2', e) }
  }

  // Parse each .crate file
  await Promise.all(crateFiles.map(async file => {
    // Crate name = filename without extension, %% = nested separator
    const key   = file.name.replace(/\.crate$/, '')
    crateNames.push(key)
    try {
      const buf   = await readFileAsBuffer(file)
      const paths = parseSeratoCrate(buf)
      crateTrackPaths[key] = paths

      // Build track records
      paths.forEach(rawPath => {
        const normPath = rawPath.replace(/\\/g, '/')
        const existing = dbMeta[normPath]
        const id       = normPath

        if (!tracks[id]) {
          const { artist, title } = trackFromPath(normPath)
          tracks[id] = {
            id,
            title:  existing?.title  || title,
            artist: existing?.artist || artist,
            bpm:    existing?.bpm,
            genre:  existing?.genre,
            path:   normPath,
          }
        }
      })
    } catch (e) { console.warn(`Could not parse crate: ${file.name}`, e) }
  }))

  const crates = buildSeratoCrateTree(crateNames, crateTrackPaths, tracks)

  return {
    source: 'serato',
    filename: '_Serato_',
    tracks,
    crates,
    totalTracks: Object.keys(tracks).length,
  }
}

// ══════════════════════════════════════════════════════════════
// CRATE UTILITIES
// ══════════════════════════════════════════════════════════════

// Get all track IDs in a crate (including children recursively)
function getAllTrackIds(crate: Crate): string[] {
  const ids = [...crate.trackIds]
  crate.children.forEach(child => ids.push(...getAllTrackIds(child)))
  return [...new Set(ids)]
}

// Count all tracks in a crate + its children
function countTracks(crate: Crate): number {
  return getAllTrackIds(crate).length
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function LibraryImporter({ onBuildSet, loading }: Props) {
  const [tab,            setTab]            = useState<'rekordbox'|'traktor'|'serato'>('rekordbox')
  const [library,        setLibrary]        = useState<Library|null>(null)
  const [selectedId,     setSelectedId]     = useState<string|null>(null)
  const [expandedIds,    setExpandedIds]    = useState<Set<string>>(new Set())
  const [parsing,        setParsing]        = useState(false)
  const [parseError,     setParseError]     = useState<string|null>(null)
  const [dragOver,       setDragOver]       = useState(false)

  const fileRef   = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  // ── File handling ──────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    setParsing(true); setParseError(null); setLibrary(null); setSelectedId(null)
    try {
      let lib: Library

      if (tab === 'rekordbox') {
        const xmlFile = arr.find(f => f.name.endsWith('.xml')) || arr[0]
        if (!xmlFile) throw new Error('No XML file found. Export your library from Rekordbox as XML.')
        const xml = await readFileAsText(xmlFile)
        lib = parseRekordbox(xml, xmlFile.name)
      } else if (tab === 'traktor') {
        const nmlFile = arr.find(f => f.name.endsWith('.nml')) || arr[0]
        if (!nmlFile) throw new Error('No NML file found. Export your collection from Traktor.')
        const xml = await readFileAsText(nmlFile)
        lib = parseTraktor(xml, nmlFile.name)
      } else {
        // Serato — expects folder containing crate files and optionally database V2
        const relevant = arr.filter(f => f.name.endsWith('.crate') || f.name === 'database V2')
        if (relevant.length === 0) throw new Error('No Serato files found. Upload your _Serato_ folder or its Subcrates folder.')
        lib = await parseSerato(relevant)
      }

      if (lib.totalTracks === 0) throw new Error(`No tracks found in this file. Make sure you exported the correct format from ${tab === 'rekordbox' ? 'Rekordbox' : tab === 'traktor' ? 'Traktor' : 'Serato'}.`)
      setLibrary(lib)
      // Auto-expand top-level folders
      const topFolders = lib.crates.filter(c => c.isFolder).map(c => c.id)
      setExpandedIds(new Set(topFolders.slice(0, 3)))
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : 'Parse failed. Please try a different file.')
    } finally {
      setParsing(false)
    }
  }, [tab])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function buildSet() {
    if (!library) return
    let trackIds: string[]

    if (!selectedId) {
      // All tracks
      trackIds = Object.keys(library.tracks)
    } else if (selectedId === '__all__') {
      trackIds = Object.keys(library.tracks)
    } else {
      // Find crate
      function findCrate(crates: Crate[], id: string): Crate | null {
        for (const c of crates) {
          if (c.id === id) return c
          const found = findCrate(c.children, id)
          if (found) return found
        }
        return null
      }
      const crate = findCrate(library.crates, selectedId)
      trackIds = crate ? getAllTrackIds(crate) : Object.keys(library.tracks)
    }

    const tracks = trackIds.map(id => library.tracks[id]).filter(Boolean)
    onBuildSet(tracks.slice(0, 100))  // safety cap: 100 tracks max
  }

  // ── Selected track count ───────────────────────────────────
  function selectedCount(): number {
    if (!library) return 0
    if (!selectedId || selectedId === '__all__') return library.totalTracks

    function findCrate(crates: Crate[], id: string): Crate | null {
      for (const c of crates) {
        if (c.id === id) return c
        const found = findCrate(c.children, id)
        if (found) return found
      }
      return null
    }
    const crate = findCrate(library.crates, selectedId)
    return crate ? countTracks(crate) : 0
  }

  // ── Crate tree node ────────────────────────────────────────
  function CrateNode({ crate, depth }: { crate: Crate; depth: number }) {
    const isSelected = selectedId === crate.id
    const isExpanded = expandedIds.has(crate.id)
    const count      = countTracks(crate)

    return (
      <div>
        <div
          onClick={() => {
            if (crate.isFolder) toggleExpand(crate.id)
            else setSelectedId(crate.id)
          }}
          style={{
            display:       'flex', alignItems:'center', gap:6,
            padding:       `5px 10px 5px ${12 + depth * 14}px`,
            cursor:        'pointer',
            background:    isSelected ? `${C}14` : 'transparent',
            borderLeft:    isSelected ? `2px solid ${C}` : '2px solid transparent',
            borderRadius:  4,
            transition:    '.15s',
            fontSize:      12,
          }}
          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#0d0d1a' }}
          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          {/* Icon */}
          <span style={{ fontSize:11, flexShrink:0, color: crate.isFolder ? '#f59e0b' : '#6a6a8a', transition:'.15s', display:'inline-block', transform: crate.isFolder && isExpanded ? 'rotate(90deg)' : 'none' }}>
            {crate.isFolder ? '▶' : '♪'}
          </span>
          {/* Name */}
          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: isSelected ? C : '#c8c8e0' }}>
            {crate.name}
          </span>
          {/* Count */}
          {count > 0 && (
            <span style={{ fontSize:10, color:'#4a4a66', flexShrink:0 }}>{count}</span>
          )}
        </div>
        {/* Children */}
        {crate.isFolder && isExpanded && crate.children.map(child => (
          <CrateNode key={child.id} crate={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  // ── Upload instructions per format ─────────────────────────
  const INSTRUCTIONS = {
    rekordbox: { accept:'.xml', label:'rekordbox.xml', steps:['Open Rekordbox','File → Export Collection in xml format','Upload the exported XML file'] },
    traktor:   { accept:'.nml', label:'collection.nml', steps:['Open Traktor Pro','File → Export Collection','Upload the .nml file'] },
    serato:    { accept:'', label:'_Serato_ folder', steps:['Close Serato DJ first','Locate your _Serato_ folder (~/Music/_Serato_ on Mac, C:/Users/you/Music/_Serato_ on Windows)','Upload the entire folder or just the Subcrates folder'] },
  }

  const inst = INSTRUCTIONS[tab]
  const sel  = selectedCount()

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Format tabs */}
      <div style={{ display:'flex', border:'1px solid #1f1f33', borderRadius:10, overflow:'hidden' }}>
        {(['rekordbox','traktor','serato'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setLibrary(null); setParseError(null) }}
            style={{ flex:1, padding:'8px 0', border:'none', cursor:'pointer', fontSize:10, fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5, fontWeight:600, transition:'.15s',
              background: tab===t ? `linear-gradient(100deg,${M}22,${C}22)` : '#0d0d18',
              color:      tab===t ? C : '#6a6a8a',
              borderBottom: tab===t ? `2px solid ${C}` : '2px solid transparent',
            }}>
            {t === 'rekordbox' ? 'REKORDBOX' : t === 'traktor' ? 'TRAKTOR' : 'SERATO'}
          </button>
        ))}
      </div>

      {/* Library loaded — show crate browser */}
      {library ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Library info bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#0a0a14', border:'1px solid #1f1f33', borderRadius:8, padding:'8px 12px' }}>
            <div>
              <div style={{ fontSize:11, color:'#e8e8f0', fontWeight:600 }}>{library.filename}</div>
              <div style={{ fontSize:10, color:'#6a6a8a' }}>{library.totalTracks.toLocaleString()} tracks · {library.source}</div>
            </div>
            <button onClick={() => { setLibrary(null); setSelectedId(null) }} style={{ background:'transparent', border:'1px solid #23233a', color:'#5a5a78', padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
              ✕ Clear
            </button>
          </div>

          {/* Crate browser */}
          <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:10, overflow:'hidden' }}>
            <div style={{ padding:'8px 12px 6px', fontSize:9, letterSpacing:2, color:'#4a4a66', borderBottom:'1px solid #1a1a2e' }}>CRATE BROWSER</div>

            {/* All tracks row */}
            <div onClick={() => setSelectedId('__all__')}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', cursor:'pointer', background: selectedId==='__all__'||!selectedId ? `${C}14` : 'transparent', borderLeft: selectedId==='__all__'||!selectedId ? `2px solid ${C}` : '2px solid transparent', borderRadius:4, margin:'4px 4px 2px', transition:'.15s' }}>
              <span style={{ fontSize:11, color:'#9a9ab8' }}>⊞</span>
              <span style={{ flex:1, fontSize:12, color: !selectedId||selectedId==='__all__' ? C : '#c8c8e0' }}>All Tracks</span>
              <span style={{ fontSize:10, color:'#4a4a66' }}>{library.totalTracks}</span>
            </div>

            {/* Crate tree */}
            <div style={{ maxHeight:260, overflowY:'auto', padding:'4px' }}>
              {library.crates.length === 0 ? (
                <div style={{ padding:'16px 12px', fontSize:11, color:'#4a4a66', textAlign:'center' }}>No crates found in this library.</div>
              ) : (
                library.crates.map(crate => <CrateNode key={crate.id} crate={crate} depth={0} />)
              )}
            </div>
          </div>

          {/* Build button */}
          <button onClick={buildSet} disabled={loading || sel === 0}
            style={{ background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none', padding:'12px 0', borderRadius:10, fontSize:12, fontWeight:700, cursor: loading||sel===0 ? 'default':'pointer', fontFamily:"'JetBrains Mono',monospace", letterSpacing:1, opacity: loading||sel===0 ? .5:1, transition:'.2s' }}>
            {loading ? 'BUILDING SET…' : `⚡ BUILD SET FROM ${sel > 0 ? sel : library.totalTracks} TRACKS`}
          </button>

          {sel > 50 && (
            <div style={{ fontSize:10, color:'#f59e0b', textAlign:'center', lineHeight:1.5 }}>
              Large crate — AI will pick the best {Math.min(sel, 100)} tracks for your set length
            </div>
          )}
        </div>
      ) : (
        /* Upload area */
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => tab === 'serato' ? folderRef.current?.click() : fileRef.current?.click()}
            style={{ border:`2px dashed ${dragOver ? C : '#2a2a42'}`, borderRadius:12, padding:'28px 16px', textAlign:'center', cursor:'pointer', transition:'.2s', background: dragOver ? `${C}06` : 'transparent', boxShadow: dragOver ? `0 0 20px ${C}18` : 'none' }}
          >
            <div style={{ fontSize:32, marginBottom:8 }}>
              {tab === 'rekordbox' ? '🎚️' : tab === 'traktor' ? '🎛️' : '📂'}
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:'#e8e8f0', marginBottom:4 }}>
              Drop your {inst.label} here
            </div>
            <div style={{ fontSize:11, color:'#6a6a8a', marginBottom:12 }}>
              or click to browse
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:`${C}14`, border:`1px solid ${C}33`, borderRadius:999, padding:'5px 14px', fontSize:10, color:C, fontFamily:"'JetBrains Mono',monospace" }}>
              ↑ Choose {tab === 'serato' ? 'folder' : 'file'}
            </div>
          </div>

          {/* Hidden inputs */}
          <input ref={fileRef} type="file" accept={inst.accept} style={{ display:'none' }}
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files) }} />
          <input ref={folderRef} type="file" style={{ display:'none' }}
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory="true" directory="true"
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files) }} />

          {/* Instructions */}
          <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:M, letterSpacing:1, marginBottom:8, fontWeight:600 }}>HOW TO EXPORT FROM {tab.toUpperCase()}</div>
            {inst.steps.map((step, i) => (
              <div key={i} style={{ display:'flex', gap:8, fontSize:11, color:'#6a6a8a', marginBottom:5, lineHeight:1.5 }}>
                <span style={{ color:C, flexShrink:0, fontWeight:700 }}>{i+1}.</span>{step}
              </div>
            ))}
          </div>

          {/* Parsing indicator */}
          {parsing && (
            <div style={{ textAlign:'center', fontSize:11, color:C, padding:'8px', animation:'pulse 1.2s infinite' }}>
              Parsing library…
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div style={{ padding:12, border:`1px solid ${M}`, borderRadius:8, color:M, fontSize:11, lineHeight:1.5 }}>
              {parseError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
