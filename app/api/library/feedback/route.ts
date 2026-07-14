// ▸ Place at: app/api/library/feedback/route.ts
// GET  ?setId=xxx — feedback marks for one saved set (owner-scoped)
// POST — upsert a track's hit/miss rating. Body: { setId, trackN, artist, title, genre?, rating }

import { auth }              from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logError }          from '@/lib/log-error'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const setId = new URL(req.url).searchParams.get('setId')
    if (!setId) return NextResponse.json({ error: 'Missing setId' }, { status: 400 })

    const db = createAdminClient()
    const { data, error } = await db
      .from('set_feedback')
      .select('track_n, rating')
      .eq('set_id', setId)
      .eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ feedback: data ?? [] })

  } catch (err) {
    logError('[GET /api/library/feedback]', err)
    return NextResponse.json({ error: 'Failed to load feedback.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { setId, trackN, artist, title, genre, rating } = await req.json()
    if (!setId || !Number.isInteger(trackN) || !artist || !title) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    if (rating !== 'hit' && rating !== 'miss') {
      return NextResponse.json({ error: 'Rating must be "hit" or "miss".' }, { status: 400 })
    }

    const db = createAdminClient()

    // Rating your own set only — matches rename/delete ownership rules elsewhere in library/item.
    const { data: set } = await db.from('sets').select('user_id').eq('id', setId).maybeSingle()
    if (!set || set.user_id !== userId) return NextResponse.json({ error: 'Set not found.' }, { status: 404 })

    const { error } = await db
      .from('set_feedback')
      .upsert({
        set_id: setId, user_id: userId, track_n: trackN,
        artist: String(artist).trim(), title: String(title).trim(),
        genre: genre ? String(genre).trim() : null,
        rating, updated_at: new Date().toISOString(),
      }, { onConflict: 'set_id,track_n' })
    if (error) throw error

    return NextResponse.json({ ok: true })

  } catch (err) {
    logError('[POST /api/library/feedback]', err)
    return NextResponse.json({ error: 'Failed to save feedback.' }, { status: 500 })
  }
}
