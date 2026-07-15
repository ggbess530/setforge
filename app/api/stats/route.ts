// ▸ Place at: app/api/stats/route.ts
// GET — the current user's personal stats dashboard payload: generation
// activity, genre breakdown, crowd-feedback hit rate + trend + top tracks,
// and community engagement. Everything aggregated in JS from raw rows — same
// pattern as track-history/route.ts and lib/track-feedback.ts, appropriate at
// this data volume (dozens to low hundreds of rows per DJ, not millions).

import { auth, currentUser }  from '@clerk/nextjs/server'
import { NextResponse }       from 'next/server'
import { createAdminClient }  from '@/lib/supabase'
import { checkSubscription }  from '@/lib/subscription'
import { logError }           from '@/lib/log-error'

function monthKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}
// Fills every month in the window, even ones with zero activity — a gap-free
// timeline, not a compressed one that skips silent months.
function lastNMonthKeys(n: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  return keys
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createAdminClient()
    const [user, sub, { data: sets }, { data: generateEvents }, { count: followerCount }, { data: postRows }, { data: feedbackRows }] = await Promise.all([
      currentUser(),
      checkSubscription(userId),
      db.from('sets').select('meta, created_at').eq('user_id', userId),
      db.from('usage').select('created_at').eq('user_id', userId).eq('action', 'generate'),
      db.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
      db.from('community_posts').select('like_count, comment_count').eq('user_id', userId).eq('status', 'published'),
      db.from('set_feedback').select('artist, title, rating, created_at').eq('user_id', userId),
    ])

    const totalSets = sets?.length ?? 0
    const totalGenerations = generateEvents?.length ?? 0
    const postsPublished = postRows?.length ?? 0
    const totalLikesReceived = (postRows ?? []).reduce((sum, p) => sum + (p.like_count ?? 0), 0)
    const totalCommentsReceived = (postRows ?? []).reduce((sum, p) => sum + (p.comment_count ?? 0), 0)

    const genreCounts = new Map<string, number>()
    for (const s of sets ?? []) {
      const genre = (s.meta as Record<string, unknown> | null)?.genre
      if (typeof genre === 'string' && genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
    }
    const genreBreakdown = [...genreCounts.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const monthKeys12 = lastNMonthKeys(12)
    const activityMap = new Map(monthKeys12.map(k => [k, 0]))
    for (const e of generateEvents ?? []) {
      const key = monthKey(new Date(e.created_at))
      if (activityMap.has(key)) activityMap.set(key, (activityMap.get(key) ?? 0) + 1)
    }
    const activityByMonth = monthKeys12.map(key => ({ month: monthLabel(key), count: activityMap.get(key) ?? 0 }))

    const hits = (feedbackRows ?? []).filter(f => f.rating === 'hit').length
    const misses = (feedbackRows ?? []).filter(f => f.rating === 'miss').length
    const hitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : null

    const monthKeys6 = lastNMonthKeys(6)
    const feedbackByMonthMap = new Map(monthKeys6.map(k => [k, { hits: 0, misses: 0 }]))
    for (const f of feedbackRows ?? []) {
      const entry = feedbackByMonthMap.get(monthKey(new Date(f.created_at)))
      if (entry) { if (f.rating === 'hit') entry.hits++; else entry.misses++ }
    }
    const feedbackByMonth = monthKeys6.map(key => ({ month: monthLabel(key), ...feedbackByMonthMap.get(key)! }))

    const trackMap = new Map<string, { artist: string; title: string; hits: number; misses: number }>()
    for (const f of feedbackRows ?? []) {
      const key = `${f.artist.toLowerCase()}::${f.title.toLowerCase()}`
      const entry = trackMap.get(key) ?? { artist: f.artist, title: f.title, hits: 0, misses: 0 }
      if (f.rating === 'hit') entry.hits++; else entry.misses++
      trackMap.set(key, entry)
    }
    const allTracks = [...trackMap.values()]
    const topProven = allTracks.filter(t => t.hits > t.misses).sort((a, b) => (b.hits - b.misses) - (a.hits - a.misses)).slice(0, 8)
    const topAvoid  = allTracks.filter(t => t.misses > t.hits).sort((a, b) => (b.misses - b.hits) - (a.misses - a.hits)).slice(0, 8)

    return NextResponse.json({
      memberSince: user?.createdAt ? new Date(user.createdAt).toISOString() : null,
      tier: sub.tier,
      totalSets, totalGenerations,
      followerCount: followerCount ?? 0,
      postsPublished, totalLikesReceived, totalCommentsReceived,
      genreBreakdown, activityByMonth,
      feedback: { hits, misses, hitRate, byMonth: feedbackByMonth, topProven, topAvoid },
    })

  } catch (err) {
    logError('[GET /api/stats]', err)
    return NextResponse.json({ error: 'Failed to load stats.' }, { status: 500 })
  }
}
