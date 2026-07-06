// ▸ Create folder: app/api/spotify/
// ▸ Place at:      app/api/spotify/route.ts

import { NextResponse } from 'next/server'

// ── Spotify client credentials flow (token cached across warm invocations) ──
let cachedToken: { token: string; expiresAt: number } | null = null

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token

  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const res   = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'grant_type=client_credentials',
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Spotify auth failed')

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cachedToken.token
}

// ── Spotify key integers → Camelot ───────────────────────────
// Spotify key: 0=C, 1=C#/Db, 2=D, 3=D#/Eb, 4=E, 5=F,
//              6=F#/Gb, 7=G, 8=G#/Ab, 9=A, 10=A#/Bb, 11=B
// mode: 1=major, 0=minor
const SPOTIFY_TO_CAMELOT: Record<string, string> = {
  '0-1':'8B',  '1-1':'3B',  '2-1':'10B', '3-1':'5B',
  '4-1':'12B', '5-1':'7B',  '6-1':'2B',  '7-1':'9B',
  '8-1':'4B',  '9-1':'11B', '10-1':'6B', '11-1':'1B',
  '0-0':'5A',  '1-0':'12A', '2-0':'7A',  '3-0':'2A',
  '4-0':'9A',  '5-0':'4A',  '6-0':'11A', '7-0':'6A',
  '8-0':'1A',  '9-0':'8A',  '10-0':'3A', '11-0':'10A',
}

// ── Normalization ─────────────────────────────────────────────
// Strips diacritics, remix/edit noise words, and punctuation so query
// building and candidate scoring compare like-for-like.
const NOISE_WORDS = /\b(original mix|extended mix|radio edit|club mix|remix|edit|vip mix|rework|re[- ]?master(ed)?(\s\d{4})?|mono|stereo|clean|explicit|instrumental|acoustic|live|deluxe(\sedition)?|bonus track|single version|album version)\b/gi

function normalizeTitle(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[([][^)\]]*(feat\.?|ft\.?|featuring)[^)\]]*[)\]]/gi, '')
    .replace(/\b(feat\.?|ft\.?|featuring)\b.*$/i, '')
    .replace(NOISE_WORDS, '')
    .replace(/[()[\]{}\-–—_,.'"!?:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Splits a multi-artist string ("A feat. B & C x D") into individual, normalized names.
function normalizeArtists(s: string): string[] {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|&|\bx\b|\bvs\.?\b|\band\b|,/gi)
    .map(p => p.replace(/[()[\]{}.'"!?:;]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// ── Fuzzy similarity (normalized Levenshtein, 0..1) ──────────
function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[b.length]
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (!maxLen) return 1
  return 1 - levenshtein(a, b) / maxLen
}

type SpotifyTrack = { id: string; name: string; artists: { name: string }[]; album: { name: string }; external_urls: { spotify: string } }

// Scores a candidate against the query — title weighted higher (more discriminating),
// but a real artist match is still required to avoid same-title/wrong-artist mixups.
function scoreCandidate(track: SpotifyTrack, queryTitleNorm: string, queryArtistTokens: string[]): number {
  const titleSim = similarity(normalizeTitle(track.name), queryTitleNorm)
  const trackArtistTokens = track.artists.flatMap(a => normalizeArtists(a.name))
  const artistSim = queryArtistTokens.length && trackArtistTokens.length
    ? Math.max(...queryArtistTokens.flatMap(q => trackArtistTokens.map(t => similarity(q, t))))
    : 0
  const score = titleSim * 0.55 + artistSim * 0.45
  // A near-perfect title match means nothing if the artist is clearly different —
  // two unrelated songs can easily share a title. Penalize hard when there's no real artist evidence.
  return artistSim < 0.3 ? score * 0.6 : score
}

async function searchTracks(q: string, limit: number, token: string): Promise<SpotifyTrack[]> {
  const res  = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return data?.tracks?.items || []
}

const HIGH_CONFIDENCE = 0.82  // good enough to stop searching early
const MIN_ACCEPTABLE  = 0.55  // below this, we'd rather say "not found" than guess wrong

// ── POST /api/spotify ─────────────────────────────────────────
// Body: { artist: string, title: string }
// Returns: { bpm, key (Camelot), spotifyId, found: boolean }
export async function POST(req: Request) {
  try {
    const { artist, title } = await req.json()
    if (!artist && !title) return NextResponse.json({ found: false })

    const token = await getSpotifyToken()

    const queryTitleNorm    = normalizeTitle(title || '')
    const queryArtistTokens = normalizeArtists(artist || '')

    const seen = new Map<string, SpotifyTrack>()
    function addCandidates(tracks: SpotifyTrack[]) {
      for (const t of tracks) if (!seen.has(t.id)) seen.set(t.id, t)
    }
    function currentBest(): { track: SpotifyTrack; score: number } | null {
      let top: { track: SpotifyTrack; score: number } | null = null
      for (const t of seen.values()) {
        const score = scoreCandidate(t, queryTitleNorm, queryArtistTokens)
        if (!top || score > top.score) top = { track: t, score }
      }
      return top
    }

    // 1. Strict field-filter search — cheapest, most precise when it hits
    addCandidates(await searchTracks(`track:"${title}" artist:"${artist}"`, 3, token))
    let best = currentBest()

    // 2. Normalized free-text search — catches remix/edit suffix mismatches, typos
    if (!best || best.score < HIGH_CONFIDENCE) {
      addCandidates(await searchTracks(`${queryTitleNorm} ${queryArtistTokens.join(' ')}`.trim(), 5, token))
      best = currentBest()
    }

    // 3. Title-only search — widest net, for heavily-retagged remixes/features
    if ((!best || best.score < HIGH_CONFIDENCE) && queryTitleNorm) {
      addCandidates(await searchTracks(queryTitleNorm, 8, token))
      best = currentBest()
    }

    if (!best || best.score < MIN_ACCEPTABLE) return NextResponse.json({ found: false })

    return await fetchFeatures(best.track.id, best.track, token)

  } catch (err) {
    console.error('[POST /api/spotify]', err)
    return NextResponse.json({ found: false, error: 'Spotify lookup failed' })
  }
}

async function fetchFeatures(
  trackId: string,
  track:   { name: string; artists: { name: string }[]; album: { name: string }; external_urls: { spotify: string } },
  token:   string
) {
  const featRes  = await fetch(
    `https://api.spotify.com/v1/audio-features/${trackId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const trackBase = {
    found:      true,
    spotifyId:  trackId,
    spotifyUrl: track.external_urls?.spotify,
    trackName:  track.name,
    artistName: track.artists?.[0]?.name,
  }

  if (!featRes.ok) {
    // audio-features endpoint restricted (403) — return track match without BPM/key
    console.warn(`[spotify] audio-features ${featRes.status} for ${trackId}`)
    return NextResponse.json({ ...trackBase, audioFeaturesUnavailable: true })
  }

  const features = await featRes.json()

  if (!features?.tempo) {
    console.warn('[spotify] audio-features returned no tempo:', features)
    return NextResponse.json({ ...trackBase, audioFeaturesUnavailable: true })
  }

  const bpm     = Math.round(features.tempo)
  const camelot = SPOTIFY_TO_CAMELOT[`${features.key}-${features.mode}`]

  return NextResponse.json({
    ...trackBase,
    bpm,
    key:          camelot || null,
    spotifyKey:   features.key,
    mode:         features.mode,
    energy:       Math.round(features.energy * 10),
    danceability: Math.round(features.danceability * 10),
  })
}
