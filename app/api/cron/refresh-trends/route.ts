// ▸ Create folder: app/api/cron/refresh-trends/
// ▸ Place at:      app/api/cron/refresh-trends/route.ts
//
// Triggered daily by Vercel Cron (see vercel.json). Vercel signs cron
// requests with a bearer token matching CRON_SECRET — reject anything else
// so this can't be hit as a public endpoint.

import { NextResponse } from 'next/server'
import { refreshTrendingTracks } from '@/lib/trend-ingest'
import { timingSafeEqualStr } from '@/lib/secure-compare'
import { logError } from '@/lib/log-error'

export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || !timingSafeEqualStr(auth, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await refreshTrendingTracks()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logError('[GET /api/cron/refresh-trends]', err)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
