// ▸ Place at: lib/id3-parser.ts
// Pure browser-side ID3v2 tag reader - no dependencies
// Reads: artist, title, BPM, key from audio files

export interface ID3Tags {
  artist?:  string
  title?:   string
  bpm?:     number
  key?:     string    // raw key e.g. "Am", "C", "F#m"
  camelot?: string    // converted to Camelot notation
  album?:   string
  duration?: number
}

// ── Key → Camelot conversion ──────────────────────────────────
const KEY_TO_CAMELOT: Record<string, string> = {
  'C':  '8B',  'Cmaj': '8B',  'CM': '8B',
  'G':  '9B',  'Gmaj': '9B',  'GM': '9B',
  'D':  '10B', 'Dmaj': '10B', 'DM': '10B',
  'A':  '11B', 'Amaj': '11B', 'AM': '11B',
  'E':  '12B', 'Emaj': '12B', 'EM': '12B',
  'B':  '1B',  'Bmaj': '1B',  'BM': '1B',
  'F#': '2B',  'Gb':   '2B',  'F#maj': '2B',
  'Db': '3B',  'C#':   '3B',  'Dbmaj': '3B',
  'Ab': '4B',  'G#':   '4B',  'Abmaj': '4B',
  'Eb': '5B',  'D#':   '5B',  'Ebmaj': '5B',
  'Bb': '6B',  'A#':   '6B',  'Bbmaj': '6B',
  'F':  '7B',  'Fmaj': '7B',  'FM': '7B',
  // Minor keys
  'Am': '8A',  'Amin': '8A',  'A minor': '8A',
  'Em': '9A',  'Emin': '9A',  'E minor': '9A',
  'Bm': '10A', 'Bmin': '10A', 'B minor': '10A',
  'F#m':'11A', 'Gbm': '11A',  'F#min': '11A',
  'C#m':'12A', 'Dbm': '12A',  'C#min': '12A',
  'G#m':'1A',  'Abm': '1A',   'G#min': '1A',
  'D#m':'2A',  'Ebm': '2A',   'D#min': '2A',
  'A#m':'3A',  'Bbm': '3A',   'A#min': '3A',
  'Fm': '4A',  'Fmin': '4A',  'F minor': '4A',
  'Cm': '5A',  'Cmin': '5A',  'C minor': '5A',
  'Gm': '6A',  'Gmin': '6A',  'G minor': '6A',
  'Dm': '7A',  'Dmin': '7A',  'D minor': '7A',
}

export function toCamelot(rawKey: string): string | undefined {
  if (!rawKey) return undefined
  const cleaned = rawKey.trim()
  // Direct lookup
  if (KEY_TO_CAMELOT[cleaned]) return KEY_TO_CAMELOT[cleaned]
  // Try normalizing: "A Minor" → "Am"
  const lower = cleaned.toLowerCase()
  if (lower.includes('minor') || lower.includes('min')) {
    const note = cleaned.split(/\s|m/i)[0]
    return KEY_TO_CAMELOT[`${note}m`] || KEY_TO_CAMELOT[`${note}min`]
  }
  if (lower.includes('major') || lower.includes('maj')) {
    const note = cleaned.split(/\s|m/i)[0]
    return KEY_TO_CAMELOT[note] || KEY_TO_CAMELOT[`${note}maj`]
  }
  return undefined
}

// ── Syncsafe integer decoder (ID3v2) ─────────────────────────
function syncsafeToInt(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] & 0x7F) << 21) |
         ((bytes[offset+1] & 0x7F) << 14) |
         ((bytes[offset+2] & 0x7F) << 7)  |
          (bytes[offset+3] & 0x7F)
}

// ── Read a UTF-16 or Latin-1 string from frame data ──────────
function readFrameString(data: Uint8Array): string {
  if (data.length === 0) return ''
  const encoding = data[0]
  const content  = data.slice(1)

  if (encoding === 1 || encoding === 2) {
    // UTF-16
    let str = ''
    const start = (content[0] === 0xFF && content[1] === 0xFE) ||
                  (content[0] === 0xFE && content[1] === 0xFF) ? 2 : 0
    const le    = content[0] === 0xFF && content[1] === 0xFE
    for (let i = start; i < content.length - 1; i += 2) {
      const code = le
        ? content[i] | (content[i+1] << 8)
        : (content[i] << 8) | content[i+1]
      if (code === 0) break
      str += String.fromCharCode(code)
    }
    return str
  } else if (encoding === 3) {
    // UTF-8
    return new TextDecoder('utf-8').decode(content).replace(/\0/g, '')
  } else {
    // Latin-1
    return Array.from(content).map(b => String.fromCharCode(b)).join('').replace(/\0/g, '')
  }
}

// ── Main ID3v2 parser ─────────────────────────────────────────
export function parseID3(buffer: ArrayBuffer): ID3Tags {
  const bytes = new Uint8Array(buffer)
  const tags: ID3Tags = {}

  // Check ID3v2 header: "ID3"
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return tags  // No ID3v2 tag
  }

  const version    = bytes[3]  // 2, 3, or 4
  const tagSize    = syncsafeToInt(bytes, 6)
  const headerSize = 10

  let offset = headerSize

  while (offset < headerSize + tagSize - 10) {
    // Frame ID (4 bytes for v2.3+, 3 bytes for v2.2)
    const frameId = version === 2
      ? String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2])
      : String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3])

    if (!frameId.trim() || frameId[0] === '\0') break

    const idLen   = version === 2 ? 3 : 4
    const sizeLen = version === 2 ? 3 : 4
    const flagLen = version === 2 ? 0 : 2

    let frameSize = 0
    if (version === 4) {
      frameSize = syncsafeToInt(bytes, offset + idLen)
    } else if (version === 3) {
      const s = bytes.slice(offset + idLen, offset + idLen + 4)
      frameSize = (s[0] << 24) | (s[1] << 16) | (s[2] << 8) | s[3]
    } else {
      const s = bytes.slice(offset + idLen, offset + idLen + 3)
      frameSize = (s[0] << 16) | (s[1] << 8) | s[2]
    }

    if (frameSize <= 0 || frameSize > tagSize) break

    const frameData = bytes.slice(offset + idLen + sizeLen + flagLen, offset + idLen + sizeLen + flagLen + frameSize)

    // Extract relevant frames
    if (frameId === 'TIT2' || frameId === 'TT2') tags.title  = readFrameString(frameData)
    if (frameId === 'TPE1' || frameId === 'TP1') tags.artist = readFrameString(frameData)
    if (frameId === 'TBPM' || frameId === 'TBP') {
      const raw = readFrameString(frameData)
      const bpm = parseFloat(raw)
      if (!isNaN(bpm) && bpm > 0) tags.bpm = Math.round(bpm)
    }
    if (frameId === 'TKEY' || frameId === 'TKE') {
      tags.key     = readFrameString(frameData)
      tags.camelot = toCamelot(tags.key)
    }
    if (frameId === 'TALB' || frameId === 'TAL') tags.album = readFrameString(frameData)

    offset += idLen + sizeLen + flagLen + frameSize
  }

  return tags
}

// ── Read first N bytes of a file ──────────────────────────────
export async function readFileHeader(file: File, bytes = 131072): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target?.result as ArrayBuffer)
    reader.onerror = reject
    // Only read first 128KB — enough for ID3 tags
    reader.readAsArrayBuffer(file.slice(0, bytes))
  })
}

// ── Scan a list of audio files ────────────────────────────────
export async function scanAudioFiles(files: File[]): Promise<(ID3Tags & { filename: string; file: File })[]> {
  const AUDIO_EXTS = ['.mp3', '.m4a', '.aiff', '.aif', '.wav', '.flac', '.ogg']
  const audioFiles = files.filter(f =>
    AUDIO_EXTS.some(ext => f.name.toLowerCase().endsWith(ext))
  )

  const results = await Promise.all(
    audioFiles.map(async file => {
      try {
        const buffer = await readFileHeader(file)
        const tags   = parseID3(buffer)

        // Fall back to filename if tags are empty
        if (!tags.title) {
          const name   = file.name.replace(/\.[^.]+$/, '')
          const dashIdx = name.indexOf(' - ')
          tags.artist  = dashIdx > 0 ? name.slice(0, dashIdx).trim() : tags.artist || ''
          tags.title   = dashIdx > 0 ? name.slice(dashIdx + 3).trim() : name
        }

        return { ...tags, filename: file.name, file }
      } catch {
        return { filename: file.name, file, title: file.name.replace(/\.[^.]+$/, '') }
      }
    })
  )

  return results
}
