// ▸ Place at: lib/track-enrichment.ts
//
// Post-generation accuracy pass: the AI guesses bpm/key for every track it proposes,
// which is often wrong for anything it isn't very confident about. This overwrites
// those guesses with real data wherever we can get it, cheapest source first:
//   1. our own crowd-sourced cache (free, instant, no external dependency)
//   2. Spotify search (to identify the track) + ReccoBeats (for real tempo/key)
//
// Also marks each track `verified`:
//   true      — cache hit, or Spotify confidently found the track (it genuinely
//               exists, even if ReccoBeats separately had no bpm/key data for it)
//   false     — Spotify search actively ran and found no confident match; this
//               track is very likely hallucinated
//   undefined — enrichment couldn't run at all for this track (e.g. Spotify auth
//               failed) — deliberately NOT the same as `false`, so an infra hiccup
//               doesn't get mistaken for every track being fake

import { getSpotifyToken, findSpotifyTrack } from './track-match'
import { getBpmKeyForSpotifyIds } from './reccobeats'
import { lookupCachedMetadata, upsertCachedMetadata } from './metadata-cache'

export type EnrichableTrack = { artist: string; title: string; bpm: number; key: string; verified?: boolean; spotifyId?: string }

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

type SpotifyCheck = { status: 'found'; spotifyId: string } | { status: 'notfound' } | { status: 'error' }

export async function enrichTracks(tracks: EnrichableTrack[]): Promise<void> {
  if (!tracks.length) return

  // 1. Our own cache first — free, instant, nothing external to fail.
  const cacheResults = await mapWithConcurrency(tracks, 8, t => lookupCachedMetadata(t.artist, t.title))

  const misses: number[] = []
  cacheResults.forEach((cached, i) => {
    if (cached) {
      tracks[i].bpm = cached.bpm
      if (cached.key) tracks[i].key = cached.key
      tracks[i].verified = true
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
    return // leave verified unset for these — infra issue, not a hallucination signal
  }

  const checks = await mapWithConcurrency(misses, 6, async (i): Promise<SpotifyCheck> => {
    try {
      const match = await findSpotifyTrack(tracks[i].artist, tracks[i].title, token)
      return match ? { status: 'found', spotifyId: match.track.id } : { status: 'notfound' }
    } catch (err) {
      console.warn('[enrichment] Spotify search failed for', tracks[i].artist, tracks[i].title, err)
      return { status: 'error' }
    }
  })

  const trackIndexBySpotifyId = new Map<string, number>()
  checks.forEach((check, m) => {
    const trackIndex = misses[m]
    if (check.status === 'found') {
      tracks[trackIndex].verified = true
      tracks[trackIndex].spotifyId = check.spotifyId
      trackIndexBySpotifyId.set(check.spotifyId, trackIndex)
    } else if (check.status === 'notfound') {
      tracks[trackIndex].verified = false
    }
    // 'error' -> leave verified unset
  })

  if (!trackIndexBySpotifyId.size) return

  // 3. Batch-resolve real BPM/key from ReccoBeats for every matched Spotify ID.
  //    A miss here just means no audio-feature data — the track's existence is
  //    already confirmed, so `verified` stays true and we keep the AI's bpm/key guess.
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
