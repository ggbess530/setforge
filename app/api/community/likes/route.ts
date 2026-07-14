// ▸ Place at: app/api/community/likes/route.ts
// POST /api/community/likes?postId=xxx — toggle like on/off (idempotent, no body needed)

import { auth }              from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logError }          from '@/lib/log-error'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const postId = new URL(req.url).searchParams.get('postId')
    if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 })

    const db = createAdminClient()
    const { data: existing } = await db
      .from('community_likes')
      .select('id')
      .eq('post_id', postId).eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      const { error } = await db.from('community_likes').delete().eq('id', existing.id)
      if (error) throw error
      await db.rpc('increment_like_count', { p_post_id: postId, p_delta: -1 })
      return NextResponse.json({ liked: false })
    }

    const { error } = await db.from('community_likes').insert({ post_id: postId, user_id: userId })
    if (error) throw error
    await db.rpc('increment_like_count', { p_post_id: postId, p_delta: 1 })
    return NextResponse.json({ liked: true })

  } catch (err) {
    logError('[POST /api/community/likes]', err)
    return NextResponse.json({ error: 'Failed to update like.' }, { status: 500 })
  }
}
