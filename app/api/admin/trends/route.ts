// ▸ Create folder: app/api/admin/trends/
// ▸ Place at:      app/api/admin/trends/route.ts
//
// Admin-only status + manual trigger for the trending-tracks pipeline.
// Gated on ADMIN_USER_IDS (same check used for the unlimited-generations
// bypass) rather than CRON_SECRET — this is a signed-in user hitting it
// from the browser, not Vercel's scheduler.

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAdmin }         from '@/lib/subscription'
import { getTrendStatus }  from '@/lib/trending'
import { refreshTrendingTracks } from '@/lib/trend-ingest'

export const maxDuration = 120

export async function GET() {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const status = await getTrendStatus()
  return NextResponse.json(status)
}

export async function POST() {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const result = await refreshTrendingTracks()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[POST /api/admin/trends]', err)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
