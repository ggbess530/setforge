-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).
--
-- Crowd feedback: after a gig, the DJ marks which tracks in a SAVED set
-- actually hit vs. missed with the real crowd. Tied to a `sets` row + track
-- position (not track_history, which is a loose per-generation log with no
-- stable id to update). artist/title are denormalized so the signal can be
-- aggregated across every set the DJ has ever played, not just this one.

create table if not exists set_feedback (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references sets(id) on delete cascade,
  user_id    text not null,
  track_n    integer not null,   -- matches Track.n within that set's set_data.tracks array
  artist     text not null,
  title      text not null,
  genre      text,               -- snapshot of the set's genre, so the signal at generation time stays genre-scoped
  rating     text not null check (rating in ('hit','miss')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (set_id, track_n)
);

create index if not exists set_feedback_user_genre_idx on set_feedback (user_id, genre);
