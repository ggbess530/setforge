// ▸ Create folder: app/api/admin/spotify/login/
// ▸ Place at:      app/api/admin/spotify/login/route.ts
//
// Kicks off Spotify's Authorization Code flow so the admin logs in as a real
// Spotify user once — see lib/spotify-user-auth.ts for why this is needed
// (Client Credentials can no longer read Spotify's own editorial playlists).
// No scopes requested — reading public playlist tracks needs none, and we
// deliberately don't ask for anything beyond that.

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/subscription'

export async function GET() {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const state = crypto.randomUUID()
  const authorizeUrl = new URL('https://accounts.spotify.com/authorize')
  authorizeUrl.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID!)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', process.env.SPOTIFY_REDIRECT_URI!)
  authorizeUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authorizeUrl.toString())
  // Short-lived, checked against the `state` Spotify hands back — standard
  // OAuth login-CSRF protection (stops a crafted callback URL from linking
  // someone else's Spotify account to our stored refresh token).
  res.cookies.set('sf_spotify_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}
