// ▸ Place at: app/api/library/feedback/item/route.ts
// DELETE ?setId=xxx&trackN=N — clear a track's rating (back to unrated).
// Query params, not a [id] folder — Windows/git issue documented in CLAUDE.md.

import { auth }              from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logError }          from '@/lib/log-error'

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const setId  = url.searchParams.get('setId')
    const trackN = Number(url.searchParams.get('trackN'))
    if (!setId || !Number.isInteger(trackN)) return NextResponse.json({ error: 'Missing setId or trackN' }, { status: 400 })

    const db = createAdminClient()
    const { error } = await db.from('set_feedback').delete().eq('set_id', setId).eq('track_n', trackN).eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ cleared: true })

  } catch (err) {
    logError('[DELETE /api/library/feedback/item]', err)
    return NextResponse.json({ error: 'Failed to clear feedback.' }, { status: 500 })
  }
}
