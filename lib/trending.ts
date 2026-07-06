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
