// ▸ Place at: lib/metadata-cache.ts
//
// ─────────────────────────────────────────────
// Supabase schema (run this SQL in your dashboard)
// ─────────────────────────────────────────────
//
// -- Crowd-sourced BPM/key cache, built from real DJ-software-tagged imports
// -- (Rekordbox/Serato/Traktor exports carry accurate analyzer-tagged metadata).
// -- Used to override the AI's guessed bpm/key during set generation whenever
// -- a track has already been seen, across ALL users, with real data attached.
// CREATE TABLE track_metadata_cache (
//   id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   normalized_artist text NOT NULL,
//   normalized_title  text NOT NULL,
//   bpm               numeric,
//   key               text,
//   sample_count      integer NOT NULL DEFAULT 1,
//   source            text,             -- 'rekordbox' | 'serato' | 'traktor' | 'manual'
//   updated_at        timestamptz DEFAULT now(),
//   UNIQUE (normalized_artist, normalized_title)
// );
// CREATE INDEX track_metadata_cache_lookup_idx ON track_metadata_cache (normalized_artist, normalized_title);

import { createAdminClient } from './supabase'
import { normalizeTitle, normalizeArtists } from './track-match'

function cacheKey(artist: string, title: string): { normalized_artist: string; normalized_title: string } | null {
  const normalized_title  = normalizeTitle(title)
  const normalized_artist = normalizeArtists(artist).sort().join(',')
  if (!normalized_title || !normalized_artist) return null
  return { normalized_artist, normalized_title }
}

export type CachedMetadata = { bpm: number; key: string | null }

export async function lookupCachedMetadata(artist: string, title: string): Promise<CachedMetadata | null> {
  const key = cacheKey(artist, title)
  if (!key) return null

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('track_metadata_cache')
      .select('bpm, key')
      .eq('normalized_artist', key.normalized_artist)
      .eq('normalized_title', key.normalized_title)
      .maybeSingle()

    if (!data || data.bpm == null) return null
    return { bpm: Math.round(data.bpm), key: data.key ?? null }
  } catch (err) {
    console.warn('[metadata-cache] lookup failed', err)
    return null
  }
}

// Fire-and-forget — callers should never await this on a user-facing request path.
// First-write-wins on conflict (keeps the earliest real value, just tracks sample_count),
// so one bad one-off import can't clobber an already-established correct entry.
export async function upsertCachedMetadata(
  artist: string, title: string, bpm: number, key: string | null, source: string,
): Promise<void> {
  const cacheKeyResult = cacheKey(artist, title)
  if (!cacheKeyResult || !bpm) return

  try {
    const supabase = createAdminClient()
    const { data: existing } = await supabase
      .from('track_metadata_cache')
      .select('id, sample_count')
      .eq('normalized_artist', cacheKeyResult.normalized_artist)
      .eq('normalized_title', cacheKeyResult.normalized_title)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('track_metadata_cache')
        .update({ sample_count: (existing.sample_count || 1) + 1 })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('track_metadata_cache')
        .insert({ ...cacheKeyResult, bpm, key, source, sample_count: 1 })
    }
  } catch (err) {
    console.warn('[metadata-cache] upsert failed', err)
  }
}
