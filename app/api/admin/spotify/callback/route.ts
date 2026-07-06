// ▸ Create folder: app/api/admin/spotify/callback/
// ▸ Place at:      app/api/admin/spotify/callback/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/subscription'
import { exchangeCodeForRefreshToken } from '@/lib/spotify-user-auth'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const code        = req.nextUrl.searchParams.get('code')
  const state       = req.nextUrl.searchParams.get('state')
  const oauthError  = req.nextUrl.searchParams.get('error')
  const cookieState = req.cookies.get('sf_spotify_oauth_state')?.value

  if (oauthError) return NextResponse.redirect(new URL('/admin?spotify=denied', req.url))
  if (!code || !state || state !== cookieState) return NextResponse.redirect(new URL('/admin?spotify=invalid_state', req.url))

  try {
    await exchangeCodeForRefreshToken(code, process.env.SPOTIFY_REDIRECT_URI!)
    const res = NextResponse.redirect(new URL('/admin?spotify=connected', req.url))
    res.cookies.delete('sf_spotify_oauth_state')
    return res
  } catch (err) {
    console.error('[GET /api/admin/spotify/callback]', err)
    return NextResponse.redirect(new URL('/admin?spotify=error', req.url))
  }
}
