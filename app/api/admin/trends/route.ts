// ▸ Create folder: app/api/admin/trends/
// ▸ Place at:      app/api/admin/trends/route.ts
//
// Admin-only status + manual trigger for the trending-tracks pipeline.
// Gated on ADMIN_USER_IDS (same check used for the unlimited-generations
// bypass) rather than CRON_SECRET — this is a signed-in user hitting it
// from the browser, not Vercel's scheduler.

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAdmin }             from '@/lib/subscription'
import { getTrendStatus }      from '@/lib/trending'
import { refreshTrendingTracks } from '@/lib/trend-ingest'
import { isSpotifyConnected }   from '@/lib/spotify-user-auth'

export const maxDuration = 120

export async function GET() {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const [status, spotifyConnected] = await Promise.all([getTrendStatus(), isSpotifyConnected()])
  return NextResponse.json({ ...status, spotifyConnected })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const result = await refreshTrendingTracks()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[POST /api/admin/trends]', err)
    const message = err instanceof Error ? err.message : 'Refresh failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
