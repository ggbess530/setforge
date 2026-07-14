-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).

-- Auto-provisioned the first time a user posts to Community or visits their own
-- profile (lib/profile.ts's getOrCreateHandle()) — never a signup-time step.
create table if not exists profile_handles (
  user_id    text primary key,
  handle     text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profile_handles_handle_idx on profile_handles (handle);

create table if not exists follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id text not null,
  followee_id text not null,
  created_at  timestamptz not null default now(),
  unique (follower_id, followee_id)
);
create index if not exists follows_follower_idx on follows (follower_id);
create index if not exists follows_followee_idx on follows (followee_id);

-- Denormalized snapshot at post-creation time — same pattern as the existing
-- author_name/author_image columns, avoids a join/lookup on every feed read.
alter table community_posts add column if not exists author_handle text;

-- Widen the existing notifications type CHECK to add 'follow'. Postgres's
-- default name for an inline CHECK on `type` in a CREATE TABLE is
-- `<table>_<column>_check` — drop-if-exists first in case a prior manual edit
-- renamed it.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('like','comment','reply','team_invite','team_accepted','follow'));
