// ▸ Place at: app/api/follow/route.ts
// POST — toggle follow/unfollow. Body: { userId: targetUserId }

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { notify }            from '@/lib/notifications'
import { logError }          from '@/lib/log-error'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId: targetId } = await req.json()
    if (!targetId || typeof targetId !== 'string') return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    if (targetId === userId) return NextResponse.json({ error: 'You cannot follow yourself.' }, { status: 400 })

    const db = createAdminClient()
    const { data: existing } = await db.from('follows').select('id').eq('follower_id', userId).eq('followee_id', targetId).maybeSingle()

    if (existing) {
      const { error } = await db.from('follows').delete().eq('id', existing.id)
      if (error) throw error
      return NextResponse.json({ following: false })
    }

    const { error } = await db.from('follows').insert({ follower_id: userId, followee_id: targetId })
    if (error) throw error

    const follower = await currentUser()
    const followerName = follower?.fullName || follower?.username || 'A DJ'
    await notify({
      userId: targetId, type: 'follow',
      actorName: followerName, actorImage: follower?.imageUrl,
      message: `${followerName} started following you`, link: '/community',
    })

    return NextResponse.json({ following: true })

  } catch (err) {
    logError('[POST /api/follow]', err)
    return NextResponse.json({ error: 'Failed to update follow.' }, { status: 500 })
  }
}
