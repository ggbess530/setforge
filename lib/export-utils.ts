// ▸ Place at: lib/export-utils.ts
// Rekordbox XML and Serato M3U export — pure client-side, no server needed

export interface ExportTrack {
  n:          number
  artist:     string
  title:      string
  bpm:        number
  key:        string   // Camelot: "8A", "3B"
  energy:     number
  transition?: string
  path?:       string  // real file location, when matched to an imported DJ-software track
}

// ── Path normalization ────────────────────────────────────────
// A track's path may arrive as a Rekordbox file:// URI, a Traktor DIR+FILE
// join, or a raw OS path (Serato) — collapse all three to one clean,
// forward-slash, drive-letter-first form the format-specific builders below
// can each reshape as needed.
function normalizePath(rawPath: string): string {
  let p = rawPath.trim()
  if (/^file:\/\//i.test(p)) {
    p = p.replace(/^file:\/\/localhost/i, '').replace(/^file:\/\//i, '')
    try { p = decodeURI(p) } catch {}
    p = p.replace(/^\/([A-Za-z]:)/, '$1')   // /C:/... -> C:/...
  }
  return p.replace(/\\/g, '/')
}

function toFileUri(rawPath: string): string {
  const p = normalizePath(rawPath)
  const withSlash = /^[A-Za-z]:/.test(p) ? `/${p}` : p
  return `file://localhost${encodeURI(withSlash)}`
}

function toTraktorLocation(rawPath: string): { dir: string; file: string; volume: string } {
  const parts = normalizePath(rawPath).split('/').filter(Boolean)
  const file  = parts.pop() || ''
  let volume  = ''
  if (/^[A-Za-z]:$/.test(parts[0] || '')) volume = parts.shift()!.toUpperCase()
  const dir = parts.length ? `/:${parts.join('/:')}/:` : '/:'
  return { dir, file, volume }
}

// ── Camelot → musical key (for Rekordbox Tonality field) ─────
const CAMELOT_TO_KEY: Record<string, string> = {
  '1A':'Ab minor', '2A':'Eb minor', '3A':'Bb minor', '4A':'F minor',
  '5A':'C minor',  '6A':'G minor',  '7A':'D minor',  '8A':'A minor',
  '9A':'E minor',  '10A':'B minor', '11A':'F# minor', '12A':'C# minor',
  '1B':'B major',  '2B':'F# major', '3B':'Db major',  '4B':'Ab major',
  '5B':'Eb major', '6B':'Bb major', '7B':'F major',   '8B':'C major',
  '9B':'G major',  '10B':'D major', '11B':'A major',  '12B':'E major',
}

// ── Rekordbox XML export ──────────────────────────────────────
export function toRekordboxXML(
  tracks:    ExportTrack[],
  setTitle:  string,
  playlistId = Date.now()
): string {
  const trackEntries = tracks.map((t, i) => {
    const id      = playlistId + i + 1
    const musicalKey = CAMELOT_TO_KEY[t.key] || ''
    const tonality   = musicalKey.split(' ')[0]   // e.g. "Ab"
    // Location is what lets Rekordbox resolve this entry to a real file in the
    // user's collection instead of showing it as missing — only emit it when
    // we have a real path, never a guessed one.
    const location = t.path ? ` Location="${escXml(toFileUri(t.path))}"` : ''

    return `    <TRACK TrackID="${id}" Name="${escXml(t.title)}" Artist="${escXml(t.artist)}" ` +
      `AverageBpm="${t.bpm.toFixed(2)}" Tonality="${tonality}" ` +
      `Rating="${Math.round(t.energy * 51)}" ` +
      `Comments="${escXml(t.transition || '')}"${location} />`
  })

  const playlistTracks = tracks.map((_, i) => {
    const id = playlistId + i + 1
    return `      <TRACK Key="${id}" />`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="SetForge" Version="1.0" Company="SetForge"/>
  <COLLECTION Entries="${tracks.length}">
${trackEntries.join('\n')}
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT">
      <NODE Type="1" Name="${escXml(setTitle)}" KeyType="0" Entries="${tracks.length}">
${playlistTracks.join('\n')}
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`
}

// ── Serato M3U export ─────────────────────────────────────────
export function toSeratoM3U(tracks: ExportTrack[], setTitle: string): string {
  const lines = ['#EXTM3U', `#PLAYLIST:${setTitle}`, '']

  tracks.forEach(t => {
    const duration = Math.round((60 / t.bpm) * 128 * 4)  // approx seconds for ~128 bars
    lines.push(`#EXTINF:${duration},${t.artist} - ${t.title}`)
    // Serato resolves M3U entries by path — use the real file when we matched
    // one, otherwise fall back to a search-friendly placeholder.
    lines.push(t.path ? normalizePath(t.path) : `${t.artist} - ${t.title}.mp3`)
    lines.push('')
  })

  return lines.join('\n')
}

// ── Traktor NML export ────────────────────────────────────────
export function toTraktorNML(tracks: ExportTrack[], setTitle: string): string {
  // Traktor key values (0-23)
  const CAM_TO_TRAKTOR: Record<string, number> = {
    '8B':0,'9B':1,'10B':2,'11B':3,'12B':4,'1B':5,'2B':6,'3B':7,'4B':8,'5B':9,'6B':10,'7B':11,
    '8A':12,'9A':13,'10A':14,'11A':15,'12A':16,'1A':17,'2A':18,'3A':19,'4A':20,'5A':21,'6A':22,'7A':23,
  }

  // Real path when we have one, else the same fabricated placeholder as before —
  // computed once and shared between COLLECTION and PLAYLISTS so their keys match.
  const locations = tracks.map(t => t.path
    ? toTraktorLocation(t.path)
    : { dir: '/SetForge/', file: `${t.artist} - ${t.title}.mp3`, volume: '' })

  const entries = tracks.map((t, i) => {
    const keyVal = CAM_TO_TRAKTOR[t.key] ?? -1
    const loc    = locations[i]
    return `    <ENTRY TITLE="${escXml(t.title)}" ARTIST="${escXml(t.artist)}">
      <LOCATION DIR="${escXml(loc.dir)}" FILE="${escXml(loc.file)}" VOLUME="${escXml(loc.volume)}" VOLUMEID="${escXml(loc.volume)}"/>
      <TEMPO BPM="${t.bpm.toFixed(2)}" BPM_QUALITY="100.000000"/>
      ${keyVal !== -1 ? `<MUSICAL_KEY VALUE="${keyVal}"/>` : ''}
      <INFO RATING="${t.energy * 51}" COMMENT="${escXml(t.transition || '')}"/>
    </ENTRY>`
  })

  const playlistEntries = tracks.map((_, i) => {
    const loc = locations[i]
    return `      <ENTRY>\n        <PRIMARYKEY TYPE="TRACK" KEY="${escXml(loc.dir + loc.file)}"/>\n      </ENTRY>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<NML VERSION="19">
  <HEAD COMPANY="Native Instruments" PROGRAM="Traktor" VERSION="SetForge Export"/>
  <COLLECTION ENTRIES="${tracks.length}">
${entries.join('\n')}
  </COLLECTION>
  <PLAYLISTS>
    <NODE TYPE="FOLDER" NAME="$ROOT">
      <SUBNODES COUNT="1">
        <NODE TYPE="PLAYLIST" NAME="${escXml(setTitle)}">
          <PLAYLIST ENTRIES="${tracks.length}" TYPE="LIST" UUID="${Date.now()}">
${playlistEntries.join('\n')}
          </PLAYLIST>
        </NODE>
      </SUBNODES>
    </NODE>
  </PLAYLISTS>
</NML>`
}

// ── Trigger download ──────────────────────────────────────────
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
