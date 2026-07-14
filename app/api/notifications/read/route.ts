// ▸ Place at: app/api/notifications/read/route.ts
// POST — mark all of the current user's notifications as read. Called when
// the bell dropdown is opened (standard pattern — no per-notification
// granularity needed).

import { auth }               from '@clerk/nextjs/server'
import { NextResponse }       from 'next/server'
import { createAdminClient }  from '@/lib/supabase'
import { logError }           from '@/lib/log-error'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createAdminClient()
    const { error } = await db.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    if (error) throw error

    return NextResponse.json({ ok: true })

  } catch (err) {
    logError('[POST /api/notifications/read]', err)
    return NextResponse.json({ error: 'Failed to mark notifications read.' }, { status: 500 })
  }
}
