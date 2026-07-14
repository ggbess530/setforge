// ▸ Place at: app/api/notifications/route.ts
// GET — recent notifications for the bell dropdown, plus the unread count for
// the badge. Polled periodically by NotificationBell.tsx, no separate
// lightweight endpoint needed at this scale (indexed, cheap query).

import { auth }               from '@clerk/nextjs/server'
import { NextResponse }       from 'next/server'
import { createAdminClient }  from '@/lib/supabase'
import { logError }           from '@/lib/log-error'

const LIMIT = 30

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createAdminClient()
    const [{ data: notifications, error }, { count: unreadCount }] = await Promise.all([
      db.from('notifications').select('id, type, actor_name, actor_image, message, link, read, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT),
      db.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false),
    ])
    if (error) throw error

    return NextResponse.json({ notifications: notifications ?? [], unreadCount: unreadCount ?? 0 })

  } catch (err) {
    logError('[GET /api/notifications]', err)
    return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 })
  }
}
