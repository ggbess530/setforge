// ▸ Place at: app/api/community/posts/item/route.ts
// DELETE /api/community/posts/item?id=xxx — remove your own post.
// Query param, not a [id] folder — Windows/git issue documented in CLAUDE.md.

import { auth }              from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logError }          from '@/lib/log-error'

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db = createAdminClient()
    const { data: post } = await db
      .from('community_posts')
      .select('user_id, audio_path')
      .eq('id', id)
      .single()

    if (!post || post.user_id !== userId) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
    }

    if (post.audio_path) {
      await db.storage.from('community-audio').remove([post.audio_path])
    }

    const { error } = await db.from('community_posts').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ deleted: true })

  } catch (err) {
    logError('[DELETE /api/community/posts/item]', err)
    return NextResponse.json({ error: 'Failed to delete post.' }, { status: 500 })
  }
}
