// ▸ Place at: lib/spotify-export.ts
// Per-user Spotify export — separate from lib/spotify-user-auth.ts (which is
// the admin's own singleton, read-only, no-scopes login used only for trend
// ingestion). This is a real Authorization Code grant per Clerk user, scoped
// to playlist-modify-public/private, used to push a generated set into the
// DJ's own Spotify account as a real playlist.
//
// No in-memory access-token cache across users (unlike getSpotifyToken() in
// track-match.ts) — export is an occasional, user-initiated action, not a hot
// path, so a fresh refresh-token exchange per call is fine.

import { createAdminClient } from './supabase'
import { fetchWithTimeout }  from './fetch-timeout'
import { getSpotifyToken, findSpotifyTrack } from './track-match'

function basicAuthHeader(): string {
  return Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
}

export async function isUserSpotifyConnected(userId: string): Promise<boolean> {
  const db = createAdminClient()
  const { data } = await db.from('spotify_user_auth').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export async function disconnectUserSpotify(userId: string): Promise<void> {
  const db = createAdminClient()
  await db.from('spotify_user_auth').delete().eq('user_id', userId)
}

// Called once, right after the user completes the Spotify login redirect.
export async function connectUserSpotify(userId: string, code: string, redirectUri: string): Promise<void> {
  const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${basicAuthHeader()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  })
  const data = await res.json()
  if (!data.refresh_token) throw new Error(`Spotify token exchange failed: ${JSON.stringify(data)}`)

  const meRes = await fetchWithTimeout('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${data.access_token}` } })
  const me = await meRes.json()

  const db = createAdminClient()
  await db.from('spotify_user_auth').upsert({
    user_id: userId, refresh_token: data.refresh_token, spotify_user_id: me?.id ?? null,
    updated_at: new Date().toISOString(),
  })
}

async function getUserAccessToken(userId: string): Promise<{ accessToken: string; spotifyUserId: string }> {
  const db = createAdminClient()
  const { data } = await db.from('spotify_user_auth').select('refresh_token, spotify_user_id').eq('user_id', userId).maybeSingle()
  if (!data) throw new Error('NOT_CONNECTED')

  const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${basicAuthHeader()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }),
  })
  const tokenData = await res.json()
  if (!tokenData.access_token) throw new Error(`Spotify token refresh failed: ${JSON.stringify(tokenData)}`)

  // Spotify occasionally rotates the refresh token on refresh — persist the new one if given.
  if (tokenData.refresh_token) {
    await db.from('spotify_user_auth').update({ refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() }).eq('user_id', userId)
  }

  let spotifyUserId = data.spotify_user_id
  if (!spotifyUserId) {
    const meRes = await fetchWithTimeout('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
    const me = await meRes.json()
    spotifyUserId = me?.id
    if (spotifyUserId) await db.from('spotify_user_auth').update({ spotify_user_id: spotifyUserId }).eq('user_id', userId)
  }

  return { accessToken: tokenData.access_token, spotifyUserId }
}

export interface ExportTrack { artist: string; title: string; spotifyId?: string }
export interface ExportResult { playlistUrl: string; matchedCount: number; totalCount: number }

export async function exportSetToSpotify(userId: string, title: string, tracks: ExportTrack[]): Promise<ExportResult> {
  const { accessToken, spotifyUserId } = await getUserAccessToken(userId)
  if (!spotifyUserId) throw new Error('Could not resolve your Spotify account.')

  // Resolve every track to a Spotify URI — reuse the verified id from
  // generation when present, otherwise fall back to the same fuzzy-match
  // cascade the metadata pipeline uses (Client Credentials token — a plain
  // catalog search needs no user auth).
  const searchToken = await getSpotifyToken()
  const uris: string[] = []
  for (const t of tracks) {
    if (t.spotifyId) { uris.push(`spotify:track:${t.spotifyId}`); continue }
    const match = await findSpotifyTrack(t.artist, t.title, searchToken)
    if (match) uris.push(`spotify:track:${match.track.id}`)
  }

  const playlistRes = await fetchWithTimeout(`https://api.spotify.com/v1/users/${spotifyUserId}/playlists`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name: title || 'SetForge Set', description: 'Created with SetForge (setforge.online)', public: false }),
  })
  const playlist = await playlistRes.json()
  if (!playlist?.id) throw new Error(`Failed to create Spotify playlist: ${JSON.stringify(playlist)}`)

  // Spotify caps "add items" at 100 URIs per request — chunk defensively even
  // though a real set is far under that.
  for (let i = 0; i < uris.length; i += 100) {
    await fetchWithTimeout(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ uris: uris.slice(i, i + 100) }),
    })
  }

  return { playlistUrl: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`, matchedCount: uris.length, totalCount: tracks.length }
}
