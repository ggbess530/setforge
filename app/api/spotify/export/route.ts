// ▸ Place at: app/api/spotify/export/route.ts
// POST — push a generated/saved set into the user's own Spotify account as a
// real playlist. Body: { title, tracks: [{ artist, title, spotifyId? }] }

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { exportSetToSpotify } from '@/lib/spotify-export'
import { logError } from '@/lib/log-error'

// Unmatched tracks each cost a live Spotify search — bound generously for a
// full-length set with nothing pre-verified.
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, tracks } = await req.json()
    if (!Array.isArray(tracks) || !tracks.length) {
      return NextResponse.json({ error: 'No tracks to export.' }, { status: 400 })
    }
    if (tracks.length > 200) {
      return NextResponse.json({ error: 'Set is too large to export in one request.' }, { status: 400 })
    }

    const cleanTracks = tracks.map((t: { artist?: unknown; title?: unknown; spotifyId?: unknown }) => ({
      artist: String(t.artist ?? ''), title: String(t.title ?? ''),
      spotifyId: typeof t.spotifyId === 'string' ? t.spotifyId : undefined,
    })).filter(t => t.artist && t.title)

    const result = await exportSetToSpotify(userId, String(title ?? 'SetForge Set'), cleanTracks)
    return NextResponse.json(result)

  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Connect your Spotify account first.', code: 'NOT_CONNECTED' }, { status: 403 })
    }
    logError('[POST /api/spotify/export]', err)
    return NextResponse.json({ error: 'Failed to export to Spotify.' }, { status: 500 })
  }
}
