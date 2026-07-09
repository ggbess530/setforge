// ▸ Create folder: app/api/liked-tracks/
// ▸ Place at:      app/api/liked-tracks/route.ts
//


import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logError } from '@/lib/log-error'

function trackKey(artist: string, title: string): string {
  return `${artist.toLowerCase().trim()}::${title.toLowerCase().trim()}`
}

// ── GET — every track the user has liked, most recently liked first ──
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createAdminClient()
    const { data, error } = await db
      .from('user_liked_tracks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ tracks: data || [] })

  } catch (err) {
    logError('[GET /api/liked-tracks]', err)
    return NextResponse.json({ error: 'Failed to load liked songs.' }, { status: 500 })
  }
}

// ── POST — like a track (idempotent upsert) ────────────────────
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { artist, title, bpm, key, energy, genre } = await req.json()
    if (!artist?.trim() || !title?.trim()) {
      return NextResponse.json({ error: 'Missing artist/title.' }, { status: 400 })
    }

    const db = createAdminClient()
    const { data, error } = await db
      .from('user_liked_tracks')
      .upsert({
        user_id:    userId,
        track_key:  trackKey(artist, title),
        artist:     artist.trim(),
        title:      title.trim(),
        bpm:        bpm || null,
        key:        key || null,
        energy:     energy || null,
        genre:      genre || null,
      }, { onConflict: 'user_id,track_key' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ track: data })

  } catch (err) {
    logError('[POST /api/liked-tracks]', err)
    return NextResponse.json({ error: 'Failed to like track.' }, { status: 500 })
  }
}

// ── DELETE /api/liked-tracks?id=xxx — unlike a track ───────────
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db = createAdminClient()
    const { error } = await db
      .from('user_liked_tracks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return NextResponse.json({ deleted: true })

  } catch (err) {
    logError('[DELETE /api/liked-tracks]', err)
    return NextResponse.json({ error: 'Failed to unlike track.' }, { status: 500 })
  }
}
