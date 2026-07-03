// ▸ Create folder: app/api/spotify/
// ▸ Place at:      app/api/spotify/route.ts

import { NextResponse } from 'next/server'

// ── Spotify client credentials flow ──────────────────────────
async function getSpotifyToken(): Promise<string> {
  const creds  = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const res    = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'grant_type=client_credentials',
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Spotify auth failed')
  return data.access_token
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

// ── POST /api/spotify ─────────────────────────────────────────
// Body: { artist: string, title: string }
// Returns: { bpm, key (Camelot), spotifyId, found: boolean }
export async function POST(req: Request) {
  try {
    const { artist, title } = await req.json()
    if (!artist && !title) return NextResponse.json({ found: false })

    const token = await getSpotifyToken()

    // 1. Try strict field-filter search first
    const q1 = encodeURIComponent(`track:"${title}" artist:"${artist}"`)
    const r1  = await fetch(
      `https://api.spotify.com/v1/search?q=${q1}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const d1    = await r1.json()
    let track   = d1?.tracks?.items?.[0]

    // 2. Fallback: plain keyword search (handles multi-word artists, alternate spellings)
    if (!track) {
      const q2 = encodeURIComponent(`${title} ${artist}`)
      const r2  = await fetch(
        `https://api.spotify.com/v1/search?q=${q2}&type=track&limit=3`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const d2 = await r2.json()
      // Pick the best match — prefer exact title match
      const candidates = d2?.tracks?.items || []
      track = candidates.find((t: { name: string }) =>
        t.name.toLowerCase().includes(title.toLowerCase())
      ) || candidates[0]
    }

    // 3. Fallback: title only (good for remixes, features)
    if (!track && title) {
      const q3 = encodeURIComponent(title)
      const r3  = await fetch(
        `https://api.spotify.com/v1/search?q=${q3}&type=track&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const d3 = await r3.json()
      const candidates = d3?.tracks?.items || []
      track = candidates.find((t: { artists: {name:string}[] }) =>
        t.artists.some((a: {name:string}) => a.name.toLowerCase().includes(artist.toLowerCase().split(' ')[0]))
      ) || null
    }

    if (!track) return NextResponse.json({ found: false })
    return await fetchFeatures(track.id, track, token)

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
