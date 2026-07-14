-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).

-- message/link are precomputed server-side at insert time (lib/notifications.ts)
-- so the frontend never has to join back to posts/comments/teams to render a
-- notification — it just displays `message` and navigates to `link` on click.
create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,   -- recipient
  type         text not null check (type in ('like','comment','reply','team_invite','team_accepted')),
  actor_name   text,
  actor_image  text,
  message      text not null,
  link         text not null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_idx   on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read = false;
