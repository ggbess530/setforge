// ▸ Place at: lib/subscription.ts

import { createAdminClient } from './supabase'
import { getRiddenTeam, getOwnedTeam, getTeamMemberIds } from './team'

export type Tier = 'free' | 'pro' | 'team'

// Monthly generation limits — null means unlimited. Pro/Team are soft caps,
// not metered billing: sized well above real usage (typical DJs generate a
// handful of sets a week) so they read as "unlimited" in practice, while
// bounding worst-case Anthropic API spend per account per month. team is a
// POOLED cap shared by the owner + all invited seats (see getTeamMonthlyUsage)
// — otherwise a 5-seat team could multiply the cap 5x by spreading usage
// across members.
const MONTHLY_LIMITS: Record<Tier, number | null> = {
  free: 5,
  pro:  150,
  team: 400,
}

// 7-day trial gives full Pro access with no payment method on file — cap it
// like a generous trial rather than truly unlimited, so a burst of signups
// (or repeat trial abuse) can't run up API spend with zero revenue behind it.
const TRIAL_LIMIT = 30

export interface TrialInfo {
  active:   boolean
  daysLeft: number
}

export interface SubscriptionStatus {
  active:               boolean
  tier:                 Tier
  remainingGenerations: number | null  // null = unlimited
  trial?:               TrialInfo
  isFree?:              boolean        // true when on permanent free tier
}

export function isAdmin(userId: string): boolean {
  return (process.env.ADMIN_USER_IDS || '')
    .split(',').map(id => id.trim()).filter(Boolean)
    .includes(userId)
}

function startOfMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

async function getMonthlyUsage(userId: string): Promise<number> {
  const db = createAdminClient()
  const { count } = await db
    .from('usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'generate')
    .gte('created_at', startOfMonth().toISOString())
  return count ?? 0
}

// Sums 'generate' usage across every seat on a team (owner + invited members)
// so the team-tier cap is a shared pool, not a per-seat multiplier.
async function getTeamMonthlyUsage(teamId: string, ownerId: string): Promise<number> {
  const db = createAdminClient()
  const memberIds = await getTeamMemberIds(teamId, ownerId)
  const { count } = await db
    .from('usage')
    .select('*', { count: 'exact', head: true })
    .in('user_id', memberIds)
    .eq('action', 'generate')
    .gte('created_at', startOfMonth().toISOString())
  return count ?? 0
}

// Usage since the trial started (trial is always exactly 7 days), not
// calendar-month — a trial never spans a full month, so the monthly window
// getMonthlyUsage uses would undercount it.
async function getTrialUsage(userId: string, trialEndsAt: string): Promise<number> {
  const db = createAdminClient()
  const trialStart = new Date(new Date(trialEndsAt).getTime() - 7 * 24 * 60 * 60 * 1000)
  const { count } = await db
    .from('usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'generate')
    .gte('created_at', trialStart.toISOString())
  return count ?? 0
}

// ── Main check ────────────────────────────────────────────────
export async function checkSubscription(userId: string): Promise<SubscriptionStatus> {

  // Admin bypass — unlimited agency-level access
  if (isAdmin(userId)) {
    return { active: true, tier: 'pro', remainingGenerations: null }
  }

  // Invited team member riding an active Team owner's subscription — no
  // separate billing, no personal trial row needed. Shares the owner's team
  // generation pool (see getTeamMonthlyUsage) rather than getting their own
  // unlimited allotment. Falls through to normal per-user logic below if the
  // owner's sub lapses (never fully blocked).
  const riddenTeam = await getRiddenTeam(userId)
  if (riddenTeam) {
    const used      = await getTeamMonthlyUsage(riddenTeam.id, riddenTeam.ownerId)
    const remaining = Math.max(0, (MONTHLY_LIMITS.team ?? 0) - used)
    return { active: true, tier: 'team', remainingGenerations: remaining }
  }

  const db = createAdminClient()
  const { data: sub } = await db
    .from('subscriptions')
    .select('tier, status, trial_ends_at')
    .eq('user_id', userId)
    .single()

  // ── Brand new user — start 7-day Pro trial ────────────────
  if (!sub) {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await db.from('subscriptions').insert({
      user_id:       userId,
      tier:          'pro',
      status:        'trial',
      trial_ends_at: trialEndsAt,
      updated_at:    new Date().toISOString(),
    })
    return { active: true, tier: 'pro', remainingGenerations: TRIAL_LIMIT, trial: { active: true, daysLeft: 7 } }
  }

  // ── Active paid subscription ──────────────────────────────
  if (sub.status === 'active') {
    const tier = (sub.tier ?? 'free') as Tier
    if (MONTHLY_LIMITS[tier] === null) {
      return { active: true, tier, remainingGenerations: null }
    }
    if (tier === 'team') {
      const owned = await getOwnedTeam(userId)
      const used      = owned ? await getTeamMonthlyUsage(owned.id, userId) : await getMonthlyUsage(userId)
      const remaining = Math.max(0, (MONTHLY_LIMITS.team ?? 0) - used)
      return { active: true, tier, remainingGenerations: remaining }
    }
    const used      = await getMonthlyUsage(userId)
    const remaining = Math.max(0, (MONTHLY_LIMITS[tier] ?? 5) - used)
    return { active: true, tier, remainingGenerations: remaining }
  }

  // ── Active trial ──────────────────────────────────────────
  if (sub.status === 'trial' && sub.trial_ends_at) {
    const now      = new Date()
    const trialEnd = new Date(sub.trial_ends_at)

    if (now < trialEnd) {
      const daysLeft  = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const used      = await getTrialUsage(userId, sub.trial_ends_at)
      const remaining = Math.max(0, TRIAL_LIMIT - used)
      return { active: true, tier: 'pro', remainingGenerations: remaining, trial: { active: true, daysLeft } }
    }

    // Trial just expired — auto-downgrade to free tier
    await db.from('subscriptions').update({
      status:     'free',
      tier:       'free',
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    const used      = await getMonthlyUsage(userId)
    const remaining = Math.max(0, 5 - used)
    return { active: true, tier: 'free', remainingGenerations: remaining, isFree: true, trial: { active: false, daysLeft: 0 } }
  }

  // ── Permanent free tier ───────────────────────────────────
  if (sub.status === 'free') {
    const used      = await getMonthlyUsage(userId)
    const remaining = Math.max(0, 5 - used)
    return { active: true, tier: 'free', remainingGenerations: remaining, isFree: true }
  }

  // ── Inactive / cancelled — drop to free tier ──────────────
  const used      = await getMonthlyUsage(userId)
  const remaining = Math.max(0, 5 - used)
  return { active: true, tier: 'free', remainingGenerations: remaining, isFree: true }
}

// ── Community mix-upload quota ──────────────────────────────────
// Storage accumulates over time (unlike a stateless generate call), so free
// tier gets a small lifetime cap instead of a monthly one — otherwise a free
// user could re-fill their quota every month forever with no cost ceiling.
interface MixUploadLimit {
  count:          number
  period:         'lifetime' | 'month'
  maxFileBytes:   number
  maxDurationSec: number
}
const MIX_UPLOAD_LIMITS: Record<Tier, MixUploadLimit> = {
  free: { count: 3,  period: 'lifetime', maxFileBytes: 8  * 1024 * 1024, maxDurationSec: 360 },
  pro:  { count: 20, period: 'month',    maxFileBytes: 15 * 1024 * 1024, maxDurationSec: 600 },
  team: { count: 20, period: 'month',    maxFileBytes: 15 * 1024 * 1024, maxDurationSec: 600 },
}

export interface MixUploadQuota {
  allowed:        boolean
  remaining:      number
  maxFileBytes:   number
  maxDurationSec: number
}

export async function checkMixUploadQuota(userId: string): Promise<MixUploadQuota> {
  const limits = isAdmin(userId) ? MIX_UPLOAD_LIMITS.pro : MIX_UPLOAD_LIMITS[(await checkSubscription(userId)).tier]
  if (isAdmin(userId)) return { allowed: true, remaining: limits.count, maxFileBytes: limits.maxFileBytes, maxDurationSec: limits.maxDurationSec }

  const db = createAdminClient()
  let query = db.from('community_posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'mix')
  if (limits.period === 'month') {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    query = query.gte('created_at', startOfMonth.toISOString())
  }
  const { count } = await query
  const remaining = Math.max(0, limits.count - (count ?? 0))
  return { allowed: remaining > 0, remaining, maxFileBytes: limits.maxFileBytes, maxDurationSec: limits.maxDurationSec }
}

// ── Usage recorder ────────────────────────────────────────────
export async function recordUsage(userId: string, action: 'generate' | 'swap') {
  if (isAdmin(userId)) return
  try {
    const db = createAdminClient()
    await db.from('usage').insert({ user_id: userId, action })
  } catch (err) {
    console.error('[recordUsage]', err)
  }
}