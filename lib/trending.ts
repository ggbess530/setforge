// ▸ Place at: lib/trending.ts
//


import { createAdminClient } from './supabase'
import { GENRE_TREND_SOURCES } from './trend-sources'

export type TrendingTrack = { artist: string; title: string; bpm: number | null; key: string | null }

const STALE_AFTER_DAYS = 14

// Genre selector always sends an exact GENRE_TREND_SOURCES key, but custom
// free-text genres (and any casing/whitespace drift) need a looser fallback.
function resolveGenreKey(genre: string): string | null {
  const trimmed = genre.trim()
  if (GENRE_TREND_SOURCES[trimmed]) return trimmed

  const lower = trimmed.toLowerCase()
  const exact = Object.keys(GENRE_TREND_SOURCES).find(k => k.toLowerCase() === lower)
  if (exact) return exact

  return Object.keys(GENRE_TREND_SOURCES).find(k => lower.includes(k.toLowerCase())) ?? null
}

export type TrendStatus = {
  totalTracks:    number
  lastRefreshed:  string | null   // most recent last_seen_at across all rows, or null if never run
  byGenre:        { genre: string; trackCount: number }[]
}

// Powers the admin dashboard — reads the whole table rather than a SQL GROUP BY
// since row counts are small (10 genres x ~100 tracks) and this avoids needing
// a Postgres view/RPC just for an internal status readout.
export async function getTrendStatus(): Promise<TrendStatus> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('trending_tracks').select('genre, last_seen_at')
  const rows = data ?? []

  const counts = new Map<string, number>()
  let lastRefreshed: string | null = null
  for (const row of rows) {
    counts.set(row.genre, (counts.get(row.genre) ?? 0) + 1)
    if (!lastRefreshed || row.last_seen_at > lastRefreshed) lastRefreshed = row.last_seen_at
  }

  return {
    totalTracks: rows.length,
    lastRefreshed,
    byGenre: [...counts.entries()]
      .map(([genre, trackCount]) => ({ genre, trackCount }))
      .sort((a, b) => b.trackCount - a.trackCount),
  }
}

export async function getTrendingTracksForGenre(genre: string, limit = 20): Promise<TrendingTrack[]> {
  const genreKey = resolveGenreKey(genre || '')
  if (!genreKey) return []

  try {
    const supabase = createAdminClient()
    const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data } = await supabase
      .from('trending_tracks')
      .select('artist, title, bpm, key')
      .eq('genre', genreKey)
      .gte('last_seen_at', staleCutoff)
      .order('times_seen', { ascending: false })
      .order('rank', { ascending: true })
      .limit(limit)

    return data ?? []
  } catch (err) {
    console.warn('[trending] lookup failed', err)
    return []
  }
}
