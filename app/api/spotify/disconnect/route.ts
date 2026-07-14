// ▸ Place at: app/api/spotify/disconnect/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { disconnectUserSpotify } from '@/lib/spotify-export'
import { logError } from '@/lib/log-error'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await disconnectUserSpotify(userId)
    return NextResponse.json({ disconnected: true })
  } catch (err) {
    logError('[POST /api/spotify/disconnect]', err)
    return NextResponse.json({ error: 'Failed to disconnect.' }, { status: 500 })
  }
}
