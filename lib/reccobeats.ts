// ▸ Place at: lib/reccobeats.ts
// ReccoBeats (https://reccobeats.com) fills the gap left by Spotify locking its own
// /v1/audio-features endpoint behind extended-quota approval. Free for commercial use,
// no API key, and its response reuses Spotify's exact key/mode integer scheme — so the
// same SPOTIFY_TO_CAMELOT table in lib/track-match.ts applies unchanged.
//
// Flow: resolve a Spotify track ID to ReccoBeats' internal ID (batched), then fetch
// audio-features per resolved track.

import { SPOTIFY_TO_CAMELOT } from './track-match'
import { fetchWithTimeout } from './fetch-timeout'

const BASE = 'https://api.reccobeats.com/v1'

type ReccoTrack = { id: string; href: string }

function spotifyIdFromHref(href: string): string | null {
  return href?.match(/\/track\/([A-Za-z0-9]+)/)?.[1] ?? null
}

// Batch-resolves Spotify track IDs to ReccoBeats internal IDs.
// Missing tracks (not in ReccoBeats' catalog) are silently omitted, not an error.
async function resolveReccoBeatsIds(spotifyIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!spotifyIds.length) return map

  const res = await fetchWithTimeout(`${BASE}/track?ids=${spotifyIds.join(',')}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return map

  const data = await res.json()
  for (const t of (data?.content || []) as ReccoTrack[]) {
    const spotifyId = spotifyIdFromHref(t.href)
    if (spotifyId) map.set(spotifyId, t.id)
  }
  return map
}

async function fetchAudioFeatures(reccoId: string): Promise<{ bpm: number; key: string | null } | null> {
  const res = await fetchWithTimeout(`${BASE}/track/${reccoId}/audio-features`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null

  const data = await res.json()
  if (typeof data?.tempo !== 'number') return null

  return {
    bpm: Math.round(data.tempo),
    key: SPOTIFY_TO_CAMELOT[`${data.key}-${data.mode}`] ?? null,
  }
}

// Given a batch of confident Spotify track IDs, returns real BPM/Camelot key for
// whichever ones ReccoBeats has data for. Tracks with no match are simply absent
// from the returned map — callers should keep their existing guess for those.
export async function getBpmKeyForSpotifyIds(spotifyIds: string[]): Promise<Map<string, { bpm: number; key: string | null }>> {
  const result = new Map<string, { bpm: number; key: string | null }>()
  if (!spotifyIds.length) return result

  const idMap = await resolveReccoBeatsIds(spotifyIds)
  if (!idMap.size) return result

  await Promise.all([...idMap].map(async ([spotifyId, reccoId]) => {
    try {
      const features = await fetchAudioFeatures(reccoId)
      if (features) result.set(spotifyId, features)
    } catch (err) {
      console.warn('[reccobeats] audio-features failed for', spotifyId, err)
    }
  }))

  return result
}
