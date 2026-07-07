// ▸ Place at: lib/spotify-user-auth.ts
//
// ─────────────────────────────────────────────
// Supabase schema (run this SQL in your dashboard)
// ─────────────────────────────────────────────


import { createAdminClient } from './supabase'
import { fetchWithTimeout } from './fetch-timeout'

let cachedAccessToken: { token: string; expiresAt: number } | null = null

function basicAuthHeader(): string {
  return Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
}

async function getStoredRefreshToken(): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('spotify_auth').select('refresh_token').eq('id', 1).maybeSingle()
  return data?.refresh_token ?? null
}

async function saveRefreshToken(refreshToken: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('spotify_auth').upsert({ id: 1, refresh_token: refreshToken, updated_at: new Date().toISOString() })
}

export async function isSpotifyConnected(): Promise<boolean> {
  return (await getStoredRefreshToken()) !== null
}

// Called once, right after the admin completes the Spotify login redirect.
export async function exchangeCodeForRefreshToken(code: string, redirectUri: string): Promise<void> {
  const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${basicAuthHeader()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  })
  const data = await res.json()
  if (!data.refresh_token) throw new Error(`Spotify token exchange failed: ${JSON.stringify(data)}`)

  await saveRefreshToken(data.refresh_token)
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
}

// Real user-authenticated access token, cached across warm invocations same
// as getSpotifyToken() in track-match.ts. NOTE: as of Spotify's Feb 2026 API
// changes, `Get Playlist Items` only works for playlists the token's owner
// created or collaborates on — this can no longer read Spotify's own
// editorial playlists either, despite being a real user login (see trend-ingest.ts).
export async function getUserAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60_000 > Date.now()) return cachedAccessToken.token

  const refreshToken = await getStoredRefreshToken()
  if (!refreshToken) throw new Error('Spotify account not connected — visit /admin and connect Spotify first.')

  const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${basicAuthHeader()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Spotify token refresh failed: ${JSON.stringify(data)}`)

  // Spotify occasionally rotates the refresh token on refresh — persist the new one if given.
  if (data.refresh_token) await saveRefreshToken(data.refresh_token)

  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cachedAccessToken.token
}
