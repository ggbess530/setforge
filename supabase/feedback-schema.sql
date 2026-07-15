-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).
--
-- Feedback is persisted here as the source of truth regardless of whether the
-- Resend email actually goes out (email_sent tracks that separately) — so
-- nothing is lost if RESEND_API_KEY is unset or a send fails.

create table if not exists feedback_submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text,              -- nullable — signed-out visitors can leave feedback too
  user_name   text,
  user_email  text,              -- Clerk email when signed in, or whatever they typed when not
  message     text not null,
  page_url    text,              -- where they were when they submitted, for context
  email_sent  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_submissions_created_idx on feedback_submissions (created_at desc);
