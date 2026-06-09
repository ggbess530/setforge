// ▸ Place at: lib/subscription.ts

import { createClient } from '@supabase/supabase-js'

export type Tier = 'starter' | 'pro' | 'agency'

const MONTHLY_LIMITS: Record<Tier, number | null> = {
  starter: 30,
  pro:     null,
  agency:  null,
}

export interface TrialInfo {
  active:   boolean
  daysLeft: number
}

export interface SubscriptionStatus {
  active:               boolean
  tier:                 Tier
  remainingGenerations: number | null
  trial?:               TrialInfo
}

// ── Supabase client ───────────────────────────────────────────
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Admin bypass ──────────────────────────────────────────────
function isAdmin(userId: string): boolean {
  return (process.env.ADMIN_USER_IDS || '')
    .split(',').map(id => id.trim()).filter(Boolean)
    .includes(userId)
}

// ── Main check ────────────────────────────────────────────────
export async function checkSubscription(userId: string): Promise<SubscriptionStatus> {
  if (isAdmin(userId)) {
    return { active: true, tier: 'agency', remainingGenerations: null }
  }

  const db = createAdminClient()

  const { data: sub } = await db
    .from('subscriptions')
    .select('tier, status, trial_ends_at')
    .eq('user_id', userId)
    .single()

  // ── New user — auto-create 7-day trial ────────────────────
  if (!sub) {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await db.from('subscriptions').insert({
      user_id:       userId,
      tier:          'pro',
      status:        'trial',
      trial_ends_at: trialEndsAt,
      updated_at:    new Date().toISOString(),
    })
    return {
      active:               true,
      tier:                 'pro',
      remainingGenerations: null,
      trial:                { active: true, daysLeft: 7 },
    }
  }

  // ── Active paid subscription ──────────────────────────────
  if (sub.status === 'active') {
    const tier  = (sub.tier ?? 'starter') as Tier
    const limit = MONTHLY_LIMITS[tier]
    if (limit === null) return { active: true, tier, remainingGenerations: null }

    const startOfMonth = new Date()
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await db
      .from('usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'generate')
      .gte('created_at', startOfMonth.toISOString())

    const used      = count ?? 0
    const remaining = Math.max(0, limit - used)
    return { active: true, tier, remainingGenerations: remaining }
  }

  // ── Trial period check ────────────────────────────────────
  if (sub.status === 'trial' && sub.trial_ends_at) {
    const now      = new Date()
    const trialEnd = new Date(sub.trial_ends_at)

    if (now < trialEnd) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        active:               true,
        tier:                 'pro',
        remainingGenerations: null,
        trial:                { active: true, daysLeft },
      }
    }

    // Trial expired
    return {
      active:               false,
      tier:                 'starter',
      remainingGenerations: 0,
      trial:                { active: false, daysLeft: 0 },
    }
  }

  // ── Inactive / cancelled ──────────────────────────────────
  return { active: false, tier: 'starter', remainingGenerations: 0 }
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