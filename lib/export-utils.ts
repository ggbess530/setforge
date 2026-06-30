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

    return `    <TRACK TrackID="${id}" Name="${escXml(t.title)}" Artist="${escXml(t.artist)}" ` +
      `BPM="${t.bpm.toFixed(2)}" Tonality="${tonality}" ` +
      `Rating="${Math.round(t.energy * 51)}" ` +
      `Comments="${escXml(t.transition || '')}" />`
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
    // Serato reads from local paths — we use a search-friendly placeholder
    lines.push(`${t.artist} - ${t.title}.mp3`)
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

  const entries = tracks.map(t => {
    const keyVal = CAM_TO_TRAKTOR[t.key] ?? ''
    return `    <ENTRY TITLE="${escXml(t.title)}" ARTIST="${escXml(t.artist)}">
      <LOCATION DIR="/SetForge/" FILE="${escXml(t.artist)} - ${escXml(t.title)}.mp3" VOLUME="" VOLUMEID=""/>
      <TEMPO BPM="${t.bpm.toFixed(2)}" BPM_QUALITY="100.000000"/>
      ${keyVal !== '' ? `<MUSICAL_KEY VALUE="${keyVal}"/>` : ''}
      <INFO RATING="${t.energy * 51}" COMMENT="${escXml(t.transition || '')}"/>
    </ENTRY>`
  })

  const playlistEntries = tracks.map(t =>
    `      <ENTRY>\n        <PRIMARYKEY TYPE="TRACK" KEY="/SetForge/${escXml(t.artist)} - ${escXml(t.title)}.mp3"/>\n      </ENTRY>`
  )

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
