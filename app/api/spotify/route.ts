// ▸ Create folder: app/api/spotify/
// ▸ Place at:      app/api/spotify/route.ts

import { NextResponse } from 'next/server'
import { getSpotifyToken, findSpotifyTrack, SPOTIFY_TO_CAMELOT, type SpotifyTrack } from '@/lib/track-match'

// ── POST /api/spotify ─────────────────────────────────────────
// Body: { artist: string, title: string }
// Returns: { bpm, key (Camelot), spotifyId, found: boolean }
export async function POST(req: Request) {
  try {
    const { artist, title } = await req.json()
    if (!artist && !title) return NextResponse.json({ found: false })

    const token = await getSpotifyToken()
    const match = await findSpotifyTrack(artist, title, token)
    if (!match) return NextResponse.json({ found: false })

    return await fetchFeatures(match.track.id, match.track, token)

  } catch (err) {
    console.error('[POST /api/spotify]', err)
    return NextResponse.json({ found: false, error: 'Spotify lookup failed' })
  }
}

async function fetchFeatures(trackId: string, track: SpotifyTrack, token: string) {
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
