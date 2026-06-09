// ▸ Place at: lib/subscription.ts

import { createAdminClient } from './supabase'

export type Tier = 'starter' | 'pro' | 'agency'

const MONTHLY_LIMITS: Record<Tier, number | null> = {
  starter: 30,
  pro:     null,
  agency:  null,
}

export interface SubscriptionStatus {
  active:               boolean
  tier:                 Tier
  remainingGenerations: number | null
}

// ── Admin bypass ──────────────────────────────────────────────
// Add ADMIN_USER_IDS=user_xxx,user_yyy to .env.local
// Admins get unlimited agency access without a subscription
function isAdmin(userId: string): boolean {
  const admins = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
  return admins.includes(userId)
}

// ── Main check ────────────────────────────────────────────────
export async function checkSubscription(userId: string): Promise<SubscriptionStatus> {

  // Admin users bypass all subscription checks
  if (isAdmin(userId)) {
    return { active: true, tier: 'agency', remainingGenerations: null }
  }

  const db = createAdminClient()

  const { data: sub, error } = await db
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .single()

  if (error || !sub || sub.status !== 'active') {
    return { active: false, tier: 'starter', remainingGenerations: 0 }
  }

  const tier  = (sub.tier ?? 'starter') as Tier
  const limit = MONTHLY_LIMITS[tier]

  if (limit === null) {
    return { active: true, tier, remainingGenerations: null }
  }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

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

// ── Usage recorder ────────────────────────────────────────────
export async function recordUsage(userId: string, action: 'generate' | 'swap') {
  // Skip usage recording for admins
  if (isAdmin(userId)) return

  try {
    const db = createAdminClient()
    await db.from('usage').insert({ user_id: userId, action })
  } catch (err) {
    console.error('[recordUsage]', err)
  }
}