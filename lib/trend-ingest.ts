// ▸ Place at: lib/trend-ingest.ts
//
// Daily job (see app/api/cron/refresh-trends/route.ts): scans each genre's
// Spotify editorial playlist(s), resolves real bpm/key, and upserts into
// trending_tracks — plus piggybacks the existing track_metadata_cache so any
// trending track Claude later picks is instantly verified without a live
// Spotify search call during generation.

import { createAdminClient } from './supabase'
import { getSpotifyToken, normalizeTitle, normalizeArtists } from './track-match'
import { getBpmKeyForSpotifyIds } from './reccobeats'
import { upsertCachedMetadata } from './metadata-cache'
import { GENRE_TREND_SOURCES } from './trend-sources'

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

type PlaylistTrack = { spotifyId: string; artist: string; title: string; rank: number }

async function fetchPlaylistTracks(playlistId: string, token: string): Promise<{ tracks: PlaylistTrack[]; error?: string }> {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists(name)))`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const error = `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`
    console.warn('[trend-ingest] playlist fetch failed', playlistId, error)
    return { tracks: [], error }
  }

  const data = await res.json()
  type Item = { track: { id: string; name: string; artists: { name: string }[] } | null }
  const tracks = ((data?.items ?? []) as Item[])
    .map((item, i) => item.track && ({
      spotifyId: item.track.id,
      artist:    item.track.artists?.map(a => a.name).join(', ') ?? '',
      title:     item.track.name,
      rank:      i,
    }))
    .filter((t): t is PlaylistTrack => !!t && !!t.spotifyId && !!t.title)

  return tracks.length ? { tracks } : { tracks: [], error: 'Playlist returned 0 tracks (empty response)' }
}

async function upsertTrendingTrack(row: {
  genre: string; artist: string; title: string; bpm: number | null; key: string | null
  source: string; sourceRef: string; rank: number
}): Promise<void> {
  const normalized_title  = normalizeTitle(row.title)
  const normalized_artist = normalizeArtists(row.artist).sort().join(',')
  if (!normalized_title || !normalized_artist) return

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('trending_tracks')
    .select('id, times_seen')
    .eq('genre', row.genre)
    .eq('normalized_artist', normalized_artist)
    .eq('normalized_title', normalized_title)
    .eq('source', row.source)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('trending_tracks')
      .update({
        bpm: row.bpm, key: row.key, rank: row.rank,
        times_seen: (existing.times_seen || 1) + 1,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('trending_tracks').insert({
      genre: row.genre, artist: row.artist, title: row.title,
      normalized_artist, normalized_title,
      bpm: row.bpm, key: row.key,
      source: row.source, source_ref: row.sourceRef, rank: row.rank,
      times_seen: 1,
    })
  }
}

export async function refreshTrendingTracks(): Promise<{
  genresScanned: number; tracksUpserted: number
  errors: { genre: string; playlistId: string; error: string }[]
}> {
  const token = await getSpotifyToken()
  let tracksUpserted = 0
  const errors: { genre: string; playlistId: string; error: string }[] = []

  for (const [genre, { spotifyPlaylistIds }] of Object.entries(GENRE_TREND_SOURCES)) {
    for (const playlistId of spotifyPlaylistIds) {
      const { tracks, error } = await fetchPlaylistTracks(playlistId, token)
      if (error) errors.push({ genre, playlistId, error })
      if (!tracks.length) continue

      const bpmKeyMap = await getBpmKeyForSpotifyIds(tracks.map(t => t.spotifyId))

      await mapWithConcurrency(tracks, 8, async (t) => {
        const resolved = bpmKeyMap.get(t.spotifyId) ?? null
        await upsertTrendingTrack({
          genre, artist: t.artist, title: t.title,
          bpm: resolved?.bpm ?? null, key: resolved?.key ?? null,
          source: 'spotify_playlist', sourceRef: playlistId, rank: t.rank,
        })
        if (resolved?.bpm) {
          await upsertCachedMetadata(t.artist, t.title, resolved.bpm, resolved.key, 'trending_scan')
        }
        tracksUpserted++
      })
    }
  }

  return { genresScanned: Object.keys(GENRE_TREND_SOURCES).length, tracksUpserted, errors }
}
