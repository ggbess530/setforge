// ▸ Place at: lib/subscription.ts

import { createAdminClient } from './supabase'

export type Tier = 'free' | 'pro' | 'team'

// Monthly generation limits — null means unlimited
const MONTHLY_LIMITS: Record<Tier, number | null> = {
  free: 5,
  pro:  null,
  team: null,
}

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

async function getMonthlyUsage(userId: string): Promise<number> {
  const db = createAdminClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { count } = await db
    .from('usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'generate')
    .gte('created_at', startOfMonth.toISOString())
  return count ?? 0
}

// ── Main check ────────────────────────────────────────────────
export async function checkSubscription(userId: string): Promise<SubscriptionStatus> {

  // Admin bypass — unlimited agency-level access
  if (isAdmin(userId)) {
    return { active: true, tier: 'pro', remainingGenerations: null }
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
    return { active: true, tier: 'pro', remainingGenerations: null, trial: { active: true, daysLeft: 7 } }
  }

  // ── Active paid subscription ──────────────────────────────
  if (sub.status === 'active') {
    const tier = (sub.tier ?? 'free') as Tier
    if (MONTHLY_LIMITS[tier] === null) {
      return { active: true, tier, remainingGenerations: null }
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
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { active: true, tier: 'pro', remainingGenerations: null, trial: { active: true, daysLeft } }
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