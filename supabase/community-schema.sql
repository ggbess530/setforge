-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).

create table if not exists community_posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  author_name        text,          -- snapshot of Clerk display name at post time
  author_image       text,          -- snapshot of Clerk avatar URL at post time
  type               text not null check (type in ('blog','mix')),
  title              text not null,
  body               text,          -- blog body (plain text, linebreak-only — no HTML/markdown rendering) or mix caption

  -- populated only when type = 'mix'
  track1_artist      text,
  track1_title       text,
  track1_bpm         numeric,
  track1_key         text,
  track2_artist      text,
  track2_title       text,
  track2_bpm         numeric,
  track2_key         text,
  audio_path         text,          -- object path in the community-audio storage bucket
  audio_duration_sec integer,
  audio_size_bytes   bigint,

  like_count         integer not null default 0,
  status             text not null default 'published',  -- future moderation hook: 'published' | 'flagged' | 'removed'
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists community_posts_created_idx on community_posts (created_at desc);
create index if not exists community_posts_type_idx    on community_posts (type);
create index if not exists community_posts_user_idx     on community_posts (user_id);

create table if not exists community_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references community_posts(id) on delete cascade,
  user_id    text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists community_likes_post_idx on community_likes (post_id);

-- Atomic counter bump — avoids the read-then-write race a plain
-- select-then-update from the API route would have under concurrent likes.
create or replace function increment_like_count(p_post_id uuid, p_delta int)
returns void as $$
  update community_posts set like_count = greatest(0, like_count + p_delta), updated_at = now() where id = p_post_id;
$$ language sql;
