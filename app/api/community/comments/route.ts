// ▸ Place at: app/api/community/comments/route.ts
// GET  — all comments for a post, nested one level (top-level comments each
//        carry a `replies` array; replies never nest further — see schema).
// POST — create a comment or reply. A reply to a reply gets re-parented to
//        the original top-level comment (flatten), so the UI never has to
//        render arbitrary-depth threads.

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logError }          from '@/lib/log-error'

const MAX_BODY = 2000
// Comments are lower-friction than posts, so a looser daily cap — still enough
// to stop a flood-post script without getting in a real conversation's way.
const MAX_COMMENTS_PER_DAY = 50

type Row = { id: string; post_id: string; parent_id: string | null; user_id: string; author_name: string | null; author_image: string | null; body: string; created_at: string }

export async function GET(req: Request) {
  try {
    const postId = new URL(req.url).searchParams.get('postId')
    if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 })

    const db = createAdminClient()
    const { data: comments, error } = await db
      .from('community_comments')
      .select('id, post_id, parent_id, user_id, author_name, author_image, body, created_at')
      .eq('post_id', postId)
      .eq('status', 'published')
      .order('created_at', { ascending: true })
    if (error) throw error

    const rows = (comments ?? []) as Row[]
    const topLevel = rows.filter(c => !c.parent_id)
    const repliesByParent = new Map<string, Row[]>()
    for (const c of rows) {
      if (!c.parent_id) continue
      const list = repliesByParent.get(c.parent_id) ?? []
      list.push(c)
      repliesByParent.set(c.parent_id, list)
    }

    const nested = topLevel.map(c => ({ ...c, replies: repliesByParent.get(c.id) ?? [] }))
    return NextResponse.json({ comments: nested })

  } catch (err) {
    logError('[GET /api/community/comments]', err)
    return NextResponse.json({ error: 'Failed to load comments.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { postId, body, parentId } = await req.json()
    if (!postId || typeof postId !== 'string') return NextResponse.json({ error: 'Missing postId' }, { status: 400 })
    const cleanBody = String(body ?? '').trim()
    if (!cleanBody) return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 })
    if (cleanBody.length > MAX_BODY) return NextResponse.json({ error: `Comment must be ${MAX_BODY} characters or fewer.` }, { status: 400 })

    const db = createAdminClient()

    const { data: post } = await db.from('community_posts').select('id, status').eq('id', postId).maybeSingle()
    if (!post || post.status !== 'published') return NextResponse.json({ error: 'Post not found.' }, { status: 404 })

    let resolvedParentId: string | null = null
    if (parentId) {
      const { data: parent } = await db.from('community_comments').select('id, post_id, parent_id').eq('id', parentId).maybeSingle()
      if (!parent || parent.post_id !== postId) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
      resolvedParentId = parent.parent_id ?? parent.id   // flatten: reply-to-a-reply re-parents to the top-level comment
    }

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const { count } = await db
      .from('community_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfDay.toISOString())
    if ((count ?? 0) >= MAX_COMMENTS_PER_DAY) {
      return NextResponse.json({ error: `You can post up to ${MAX_COMMENTS_PER_DAY} comments a day.` }, { status: 429 })
    }

    const user = await currentUser()
    const { data: comment, error } = await db
      .from('community_comments')
      .insert({
        post_id:      postId,
        parent_id:    resolvedParentId,
        user_id:      userId,
        author_name:  user?.fullName || user?.username || 'DJ',
        author_image: user?.imageUrl || null,
        body:         cleanBody,
      })
      .select('id, post_id, parent_id, user_id, author_name, author_image, body, created_at')
      .single()
    if (error) throw error

    await db.rpc('increment_comment_count', { p_post_id: postId, p_delta: 1 })

    return NextResponse.json({ comment }, { status: 201 })

  } catch (err) {
    logError('[POST /api/community/comments]', err)
    return NextResponse.json({ error: 'Failed to post comment.' }, { status: 500 })
  }
}
