// ▸ Place at: lib/team.ts
// Team seats: a Team-tier subscriber ("owner") invites up to SEAT_LIMIT-1
// teammates who ride the owner's subscription (no separate billing) and share
// a library/set pool. team_members only ever holds invited members — the
// owner is tracked via teams.owner_id — so tier resolution below is a single
// non-recursive lookup, never a loop.

import { createAdminClient } from './supabase'

export const SEAT_LIMIT = 5   // total humans incl. owner

export interface TeamInfo {
  id:        string
  name:      string
  ownerId:   string
  seatLimit: number
}

// Called from checkSubscription() for every request — if this user is riding
// an active Team subscription as an invited member, they get team-tier access.
// Returns null for owners themselves (they're never in team_members) and for
// anyone not on a team, so the caller just falls through to normal logic.
export async function getRiddenTeam(userId: string): Promise<TeamInfo | null> {
  const db = createAdminClient()
  const { data: membership } = await db
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: team } = await db
    .from('teams')
    .select('id, name, owner_id, seat_limit')
    .eq('id', membership.team_id)
    .single()
  if (!team) return null

  const { data: ownerSub } = await db
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', team.owner_id)
    .single()
  if (ownerSub?.tier !== 'team' || ownerSub?.status !== 'active') return null

  return { id: team.id, name: team.name, ownerId: team.owner_id, seatLimit: team.seat_limit }
}

// team the user owns (has invited others into), regardless of current sub status
export async function getOwnedTeam(userId: string): Promise<TeamInfo | null> {
  const db = createAdminClient()
  const { data: team } = await db
    .from('teams')
    .select('id, name, owner_id, seat_limit')
    .eq('owner_id', userId)
    .maybeSingle()
  if (!team) return null
  return { id: team.id, name: team.name, ownerId: team.owner_id, seatLimit: team.seat_limit }
}

// Just the team id the user currently has access to (owner or actively-riding
// member) — for gating "share this set with your team" without needing the
// full TeamInfo shape. Mirrors the same active-subscription gate as
// getRiddenTeam() so shared-set access lines up with seat access.
export async function getMyTeamId(userId: string): Promise<string | null> {
  const owned = await getOwnedTeam(userId)
  if (owned) return owned.id
  const ridden = await getRiddenTeam(userId)
  return ridden?.id ?? null
}
