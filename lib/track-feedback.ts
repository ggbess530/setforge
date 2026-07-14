// ▸ Place at: lib/track-feedback.ts
// Aggregates crowd feedback (supabase/set-feedback-schema.sql) into a
// genre-scoped signal injected into generate/route.ts's prompt — same
// mechanism as getTrendingTracksForGenre() in lib/trending.ts.

import { createAdminClient } from './supabase'

export interface FeedbackTrack { artist: string; title: string; hits: number; misses: number }

const MAX_SIGNAL_TRACKS = 20

export async function getFeedbackSignal(userId: string, genre: string): Promise<{ proven: FeedbackTrack[]; avoid: FeedbackTrack[] }> {
  const db = createAdminClient()
  const { data } = await db
    .from('set_feedback')
    .select('artist, title, rating')
    .eq('user_id', userId)
    .ilike('genre', genre)   // no wildcards — case-insensitive exact match

  const map = new Map<string, FeedbackTrack>()
  for (const row of data ?? []) {
    const key = `${row.artist.toLowerCase()}::${row.title.toLowerCase()}`
    const entry = map.get(key) ?? { artist: row.artist, title: row.title, hits: 0, misses: 0 }
    if (row.rating === 'hit') entry.hits++
    else entry.misses++
    map.set(key, entry)
  }

  const all = [...map.values()]
  const proven = all.filter(t => t.hits > t.misses).sort((a, b) => (b.hits - b.misses) - (a.hits - a.misses)).slice(0, MAX_SIGNAL_TRACKS)
  const avoid  = all.filter(t => t.misses > t.hits).sort((a, b) => (b.misses - b.hits) - (a.misses - a.hits)).slice(0, MAX_SIGNAL_TRACKS)
  return { proven, avoid }
}
