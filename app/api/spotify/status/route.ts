// ▸ Place at: app/api/spotify/status/route.ts
// GET — whether the current user has connected their own Spotify account for
// export (distinct from the admin's singleton connection).

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isUserSpotifyConnected } from '@/lib/spotify-export'
import { logError } from '@/lib/log-error'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ connected: await isUserSpotifyConnected(userId) })
  } catch (err) {
    logError('[GET /api/spotify/status]', err)
    return NextResponse.json({ error: 'Failed to check status.' }, { status: 500 })
  }
}
