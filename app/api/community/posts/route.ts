// ▸ Place at: app/api/community/posts/route.ts
// GET  — paginated feed (all posts, or ?type=blog|mix), plus which posts the
//        current signed-in user has liked (empty set when signed out).
// POST — create a blog post ({ title, body }). Mix posts are created via
//        /api/community/mixes instead, once the audio upload has finished.

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getOrCreateHandle } from '@/lib/profile'
import { logError }          from '@/lib/log-error'

const PAGE_SIZE = 20
const MAX_TITLE = 120
const MAX_BODY  = 8000
// Light spam guard — blog posts are free/uncapped by tier, so this is the
// only thing standing between a signed-in user and a flood-post script.
const MAX_BLOG_POSTS_PER_DAY = 10

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    const url       = new URL(req.url)
    const type      = url.searchParams.get('type')       // 'blog' | 'mix' | null (all)
    const scope     = url.searchParams.get('scope')       // 'following' | null
    const before    = url.searchParams.get('before')      // created_at half of the cursor for "load more"
    const beforeId  = url.searchParams.get('beforeId')     // id half — ties break on this (created_at alone isn't unique, e.g. a bulk insert)

    const db = createAdminClient()

    let followeeIds: string[] | null = null
    if (scope === 'following') {
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { data: follows } = await db.from('follows').select('followee_id').eq('follower_id', userId)
      followeeIds = (follows ?? []).map(f => f.followee_id)
      if (!followeeIds.length) return NextResponse.json({ posts: [], likedIds: [], nextCursor: null, nextCursorId: null })
    }

    let query = db
      .from('community_posts')
      .select('id, user_id, author_name, author_image, author_handle, type, title, body, track1_artist, track1_title, track1_bpm, track1_key, track2_artist, track2_title, track2_bpm, track2_key, audio_path, audio_duration_sec, like_count, comment_count, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)

    if (type === 'blog' || type === 'mix') query = query.eq('type', type)
    if (before && beforeId) query = query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`)
    if (followeeIds) query = query.in('user_id', followeeIds)

    const { data: posts, error } = await query
    if (error) throw error

    const audioBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/community-audio/`
    const enriched = (posts ?? []).map(p => ({ ...p, audioUrl: p.audio_path ? audioBase + p.audio_path : null }))

    let likedIds: string[] = []
    if (userId && enriched.length) {
      const { data: likes } = await db
        .from('community_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', enriched.map(p => p.id))
      likedIds = (likes ?? []).map(l => l.post_id)
    }

    const last = enriched[enriched.length - 1]
    return NextResponse.json({
      posts:   enriched,
      likedIds,
      nextCursor:   enriched.length === PAGE_SIZE ? last.created_at : null,
      nextCursorId: enriched.length === PAGE_SIZE ? last.id         : null,
    })

  } catch (err) {
    logError('[GET /api/community/posts]', err)
    return NextResponse.json({ error: 'Failed to load community feed.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, body } = await req.json()
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Title and body are required.' }, { status: 400 })
    }
    if (title.trim().length > MAX_TITLE) return NextResponse.json({ error: `Title must be ${MAX_TITLE} characters or fewer.` }, { status: 400 })
    if (body.trim().length  > MAX_BODY)  return NextResponse.json({ error: `Post must be ${MAX_BODY} characters or fewer.` },  { status: 400 })

    const db = createAdminClient()

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const { count } = await db
      .from('community_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('type', 'blog')
      .gte('created_at', startOfDay.toISOString())
    if ((count ?? 0) >= MAX_BLOG_POSTS_PER_DAY) {
      return NextResponse.json({ error: `You can post up to ${MAX_BLOG_POSTS_PER_DAY} times a day.` }, { status: 429 })
    }

    const user = await currentUser()
    const handle = await getOrCreateHandle(userId)
    const { data: post, error } = await db
      .from('community_posts')
      .insert({
        user_id:      userId,
        author_name:  user?.fullName || user?.username || 'DJ',
        author_image: user?.imageUrl || null,
        author_handle: handle,
        type:         'blog',
        title:        title.trim(),
        body:         body.trim(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ post }, { status: 201 })

  } catch (err) {
    logError('[POST /api/community/posts]', err)
    return NextResponse.json({ error: 'Failed to create post.' }, { status: 500 })
  }
}
