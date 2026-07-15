// ▸ Place at: app/api/profile/route.ts
// GET ?handle=xxx — public profile: Clerk identity, Community posts/mixes,
// public sets (sets.is_public — same flag the existing /api/share flips),
// follower/following counts, and whether the caller follows them.

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getUserIdForHandle } from '@/lib/profile'
import { logError }          from '@/lib/log-error'

export async function GET(req: Request) {
  try {
    const handle = new URL(req.url).searchParams.get('handle')
    if (!handle) return NextResponse.json({ error: 'Missing handle' }, { status: 400 })

    const profileUserId = await getUserIdForHandle(handle)
    if (!profileUserId) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })

    const { userId: viewerId } = await auth()
    const db = createAdminClient()
    const client = await clerkClient()

    const [clerkUser, postsRes, setsRes, followerCountRes, followingCountRes, viewerFollowsRes] = await Promise.all([
      client.users.getUser(profileUserId).catch(() => null),
      db.from('community_posts').select('id, type, title, body, track1_artist, track1_title, track1_bpm, track1_key, track2_artist, track2_title, track2_bpm, track2_key, audio_path, audio_duration_sec, like_count, comment_count, created_at')
        .eq('user_id', profileUserId).eq('status', 'published').order('created_at', { ascending: false }).limit(50),
      db.from('sets').select('id, title, meta, created_at, share_id').eq('user_id', profileUserId).eq('is_public', true).order('created_at', { ascending: false }).limit(50),
      db.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', profileUserId),
      db.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileUserId),
      viewerId ? db.from('follows').select('id').eq('follower_id', viewerId).eq('followee_id', profileUserId).maybeSingle() : Promise.resolve({ data: null }),
    ])

    const audioBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/community-audio/`
    const posts = (postsRes.data ?? []).map(p => ({ ...p, audioUrl: p.audio_path ? audioBase + p.audio_path : null }))

    return NextResponse.json({
      userId:    profileUserId,
      handle,
      name:      clerkUser?.fullName || clerkUser?.username || 'DJ',
      imageUrl:  clerkUser?.imageUrl ?? null,
      isMe:      viewerId === profileUserId,
      isFollowing: !!viewerFollowsRes.data,
      followerCount:  followerCountRes.count ?? 0,
      followingCount: followingCountRes.count ?? 0,
      posts,
      publicSets: setsRes.data ?? [],
    })

  } catch (err) {
    logError('[GET /api/profile]', err)
    return NextResponse.json({ error: 'Failed to load profile.' }, { status: 500 })
  }
}
