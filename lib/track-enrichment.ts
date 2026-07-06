// ▸ Place at: lib/track-enrichment.ts
//
// Post-generation accuracy pass: the AI guesses bpm/key for every track it proposes,
// which is often wrong for anything it isn't very confident about. This overwrites
// those guesses with real data wherever we can get it, cheapest source first:
//   1. our own crowd-sourced cache (free, instant, no external dependency)
//   2. Spotify search (to identify the track) + ReccoBeats (for real tempo/key)
// Tracks we can't verify through either path keep the AI's original guess.

import { getSpotifyToken, findSpotifyTrack } from './track-match'
import { getBpmKeyForSpotifyIds } from './reccobeats'
import { lookupCachedMetadata, upsertCachedMetadata } from './metadata-cache'

export type EnrichableTrack = { artist: string; title: string; bpm: number; key: string }

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

export async function enrichTracks(tracks: EnrichableTrack[]): Promise<void> {
  if (!tracks.length) return

  // 1. Our own cache first — free, instant, nothing external to fail.
  const cacheResults = await mapWithConcurrency(tracks, 8, t => lookupCachedMetadata(t.artist, t.title))

  const misses: number[] = []
  cacheResults.forEach((cached, i) => {
    if (cached) {
      tracks[i].bpm = cached.bpm
      if (cached.key) tracks[i].key = cached.key
    } else {
      misses.push(i)
    }
  })

  if (!misses.length) return

  // 2. Spotify search to identify the remaining tracks with confidence.
  let token: string
  try {
    token = await getSpotifyToken()
  } catch (err) {
    console.warn('[enrichment] Spotify token unavailable, skipping verification', err)
    return
  }

  const spotifyMatches = await mapWithConcurrency(misses, 6, async (i) => {
    try {
      return await findSpotifyTrack(tracks[i].artist, tracks[i].title, token)
    } catch (err) {
      console.warn('[enrichment] Spotify search failed for', tracks[i].artist, tracks[i].title, err)
      return null
    }
  })

  const trackIndexBySpotifyId = new Map<string, number>()
  spotifyMatches.forEach((match, m) => {
    if (match) trackIndexBySpotifyId.set(match.track.id, misses[m])
  })

  if (!trackIndexBySpotifyId.size) return

  // 3. Batch-resolve real BPM/key from ReccoBeats for every matched Spotify ID.
  const reccoData = await getBpmKeyForSpotifyIds([...trackIndexBySpotifyId.keys()])

  trackIndexBySpotifyId.forEach((trackIndex, spotifyId) => {
    const features = reccoData.get(spotifyId)
    if (!features) return
    tracks[trackIndex].bpm = features.bpm
    if (features.key) tracks[trackIndex].key = features.key
    // Warm our own cache so this exact track never needs an external call again.
    upsertCachedMetadata(tracks[trackIndex].artist, tracks[trackIndex].title, features.bpm, features.key, 'reccobeats')
      .catch(() => {})
  })
}
