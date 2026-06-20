// ▸ Create folder: app/api/track-history/
// ▸ Place at:      app/api/track-history/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── GET — fetch recent track history for a user ───────────────
// Returns last 200 unique tracks used, with use counts
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = db()

    // Get last 60 days of history
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await client
      .from('track_history')
      .select('artist, title, bpm, key, genre, set_context, used_at')
      .eq('user_id', userId)
      .gte('used_at', since)
      .order('used_at', { ascending: false })
      .limit(500)

    if (error) throw error

    // Dedupe and count uses per track
    const trackMap: Record<string, {
      artist: string; title: string; bpm?: number; key?: string
      genre?: string; useCount: number; lastUsed: string; contexts: string[]
    }> = {}

    ;(data || []).forEach(row => {
      const key = `${row.artist.toLowerCase()}::${row.title.toLowerCase()}`
      if (trackMap[key]) {
        trackMap[key].useCount++
        if (row.set_context && !trackMap[key].contexts.includes(row.set_context)) {
          trackMap[key].contexts.push(row.set_context)
        }
      } else {
        trackMap[key] = {
          artist:    row.artist,
          title:     row.title,
          bpm:       row.bpm,
          key:       row.key,
          genre:     row.genre,
          useCount:  1,
          lastUsed:  row.used_at,
          contexts:  row.set_context ? [row.set_context] : [],
        }
      }
    })

    const tracks = Object.values(trackMap)
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 200)

    return NextResponse.json({ tracks })

  } catch (err) {
    console.error('[GET /api/track-history]', err)
    return NextResponse.json({ error: 'Failed to load track history.' }, { status: 500 })
  }
}

// ── POST — log tracks from a generated set ────────────────────
// Body: { tracks: [...], context: "Tech House / Club Peak Hour" }
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tracks, context } = await req.json()
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ logged: 0 })
    }

    const client = db()
    const rows = tracks.map((t: {
      artist: string; title: string; bpm?: number; key?: string; genre?: string
    }) => ({
      user_id:     userId,
      artist:      t.artist,
      title:       t.title,
      bpm:         t.bpm   || null,
      key:         t.key   || null,
      genre:       t.genre || null,
      set_context: context || null,
    }))

    const { error } = await client.from('track_history').insert(rows)
    if (error) throw error

    return NextResponse.json({ logged: rows.length })

  } catch (err) {
    console.error('[POST /api/track-history]', err)
    return NextResponse.json({ error: 'Failed to log tracks.' }, { status: 500 })
  }
}
