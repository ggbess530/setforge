-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).

alter table community_posts add column if not exists comment_count integer not null default 0;

-- parent_id null = top-level comment on a post. parent_id set = a reply, always
-- pointing at a top-level comment — replies are flattened to one level deep
-- (a reply-to-a-reply gets re-parented to the original top-level comment by the
-- API, same pattern most lightweight comment UIs use) so the UI never has to
-- render arbitrary-depth threads.
create table if not exists community_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references community_posts(id) on delete cascade,
  parent_id    uuid references community_comments(id) on delete cascade,
  user_id      text not null,
  author_name  text,
  author_image text,
  body         text not null,
  status       text not null default 'published',  -- future moderation hook, mirrors community_posts
  created_at   timestamptz not null default now()
);

create index if not exists community_comments_post_idx   on community_comments (post_id, created_at);
create index if not exists community_comments_parent_idx on community_comments (parent_id) where parent_id is not null;

-- Atomic counter bump — same race-avoidance reasoning as increment_like_count.
create or replace function increment_comment_count(p_post_id uuid, p_delta int)
returns void as $$
  update community_posts set comment_count = greatest(0, comment_count + p_delta) where id = p_post_id;
$$ language sql;
