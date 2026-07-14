-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).
--
-- Separate from the existing singleton `spotify_auth` table (admin's own login,
-- read-only, no scopes, used only for trend-playlist ingestion — see
-- lib/spotify-user-auth.ts). This one is per-Clerk-user, holds a token with
-- playlist-modify scopes, and powers the "export set to Spotify" feature.

create table if not exists spotify_user_auth (
  user_id         text primary key,
  refresh_token   text not null,
  spotify_user_id text,    -- cached from /me at connect time, avoids refetching on every export
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
