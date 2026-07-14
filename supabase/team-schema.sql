-- ▸ Run once in the Supabase SQL editor (this project has no migration runner —
-- schema changes are applied by hand, same as every other table documented in CLAUDE.md).

create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  owner_id   text not null unique,   -- the paying Clerk user; one team per owner
  name       text not null default 'My Team',
  seat_limit integer not null default 5,   -- total humans incl. owner
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only ever holds invited members (role='member') — the owner is tracked via
-- teams.owner_id, never inserted here. Keeps the tier-resolution lookup in
-- lib/team.ts a single non-recursive query with no risk of an owner-loop.
create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  user_id    text not null unique,   -- a user can only ride one team's subscription at a time
  joined_at  timestamptz not null default now()
);

create table if not exists team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  email       text not null,
  invited_by  text not null,
  status      text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  unique (team_id, email)
);

create index if not exists team_invites_email_idx on team_invites (email) where status = 'pending';

-- Additive, nullable — existing single-user sets/library behavior is untouched.
-- A set with shared_to_team_id set is visible to every member of that team.
alter table sets add column if not exists shared_to_team_id uuid references teams(id) on delete set null;
create index if not exists sets_shared_team_idx on sets (shared_to_team_id) where shared_to_team_id is not null;
