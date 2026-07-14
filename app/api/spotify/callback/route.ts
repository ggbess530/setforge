// ▸ Place at: app/api/spotify/callback/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { connectUserSpotify } from '@/lib/spotify-export'
import { logError } from '@/lib/log-error'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url))

  const code        = req.nextUrl.searchParams.get('code')
  const state       = req.nextUrl.searchParams.get('state')
  const oauthError  = req.nextUrl.searchParams.get('error')
  const cookieState = req.cookies.get('sf_spotify_user_oauth_state')?.value

  if (oauthError) return NextResponse.redirect(new URL('/app?spotify=denied', req.url))
  if (!code || !state || state !== cookieState) return NextResponse.redirect(new URL('/app?spotify=invalid_state', req.url))

  try {
    await connectUserSpotify(userId, code, process.env.SPOTIFY_USER_REDIRECT_URI!)
    const res = NextResponse.redirect(new URL('/app?spotify=connected', req.url))
    res.cookies.delete('sf_spotify_user_oauth_state')
    return res
  } catch (err) {
    logError('[GET /api/spotify/callback]', err)
    return NextResponse.redirect(new URL('/app?spotify=error', req.url))
  }
}
