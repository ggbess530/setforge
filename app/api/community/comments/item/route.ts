// ▸ Place at: app/api/community/comments/item/route.ts
// DELETE /api/community/comments/item?id=xxx — remove your own comment.
// Query param, not a [id] folder — Windows/git issue documented in CLAUDE.md.
// Deleting a top-level comment cascades to its replies (FK on delete cascade)
// — comment_count is decremented by the full removed count, not just 1.

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
    const { data: comment } = await db.from('community_comments').select('user_id, post_id').eq('id', id).maybeSingle()
    if (!comment || comment.user_id !== userId) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
    }

    const { count: replyCount } = await db
      .from('community_comments')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', id)

    const { error } = await db.from('community_comments').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error

    await db.rpc('increment_comment_count', { p_post_id: comment.post_id, p_delta: -(1 + (replyCount ?? 0)) })

    return NextResponse.json({ deleted: true })

  } catch (err) {
    logError('[DELETE /api/community/comments/item]', err)
    return NextResponse.json({ error: 'Failed to delete comment.' }, { status: 500 })
  }
}
