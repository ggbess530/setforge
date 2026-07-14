// ▸ Place at: app/api/spotify/login/route.ts
// Kicks off the per-user Spotify Authorization Code flow so a DJ can export
// generated sets as real playlists on their own account. Separate from
// /api/admin/spotify/login (admin-only, no scopes, read-only trend ingestion)
// — this one requests playlist-modify scopes and is open to any signed-in user.
// Requires SPOTIFY_USER_REDIRECT_URI registered as a Redirect URI in the
// Spotify Developer Dashboard (apps can have more than one registered).

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = crypto.randomUUID()
  const authorizeUrl = new URL('https://accounts.spotify.com/authorize')
  authorizeUrl.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID!)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', process.env.SPOTIFY_USER_REDIRECT_URI!)
  authorizeUrl.searchParams.set('scope', 'playlist-modify-public playlist-modify-private')
  authorizeUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authorizeUrl.toString())
  res.cookies.set('sf_spotify_user_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}
