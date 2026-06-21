// ▸ Create folder: app/api/webhooks/lemon-squeezy/
// ▸ Place at:      app/api/webhooks/lemon-squeezy/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto           from 'crypto'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Verify Lemon Squeezy webhook signature ────────────────────
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
  if (!secret) return false
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature))
}

// ── Map LS status → our tier/status ──────────────────────────
function mapSubscription(eventName: string, attributes: Record<string, unknown>): {
  status: string; tier: string; lsSubId: string; lsCustomerId: string
} {
  const variantId    = String(attributes.variant_id)
  const proVariant   = process.env.LEMON_SQUEEZY_VARIANT_PRO
  const teamVariant  = process.env.LEMON_SQUEEZY_VARIANT_TEAM

  const tier = variantId === teamVariant ? 'team'
             : variantId === proVariant  ? 'pro'
             : 'pro' // default to pro

  const lsStatus = String(attributes.status)

  let status: string
  if (eventName === 'subscription_created' && lsStatus === 'active') {
    status = 'active'
  } else if (eventName === 'subscription_updated') {
    status = lsStatus === 'active' ? 'active' : lsStatus === 'paused' ? 'paused' : 'inactive'
  } else if (eventName === 'subscription_cancelled') {
    // Cancelled but still in billing period — keep active until period ends
    status = lsStatus === 'active' ? 'active' : 'inactive'
  } else if (eventName === 'subscription_expired') {
    status = 'inactive'
  } else {
    status = lsStatus === 'active' ? 'active' : 'inactive'
  }

  return {
    status,
    tier,
    lsSubId:      String(attributes.id || ''),
    lsCustomerId: String(attributes.customer_id || ''),
  }
}

export async function POST(req: Request) {
  try {
    const payload   = await req.text()
    const signature = req.headers.get('x-signature') || ''

    if (!verifySignature(payload, signature)) {
      console.warn('[webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event     = JSON.parse(payload)
    const eventName = event?.meta?.event_name as string
    const userId    = event?.meta?.custom_data?.user_id as string
    const attrs     = event?.data?.attributes as Record<string, unknown>

    console.log(`[webhook] ${eventName} — user: ${userId}`)

    // Only handle subscription events
    const handled = [
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_expired',
    ]
    if (!handled.includes(eventName)) {
      return NextResponse.json({ received: true })
    }

    if (!userId) {
      console.error('[webhook] No user_id in custom_data')
      return NextResponse.json({ error: 'No user_id' }, { status: 400 })
    }

    const { status, tier, lsSubId, lsCustomerId } = mapSubscription(eventName, attrs)

    const client = db()
    const { error } = await client
      .from('subscriptions')
      .upsert({
        user_id:              userId,
        tier,
        status,
        ls_subscription_id:  lsSubId,
        ls_customer_id:      lsCustomerId,
        updated_at:          new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('[webhook] Supabase error:', error)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    console.log(`[webhook] Updated user ${userId} → ${tier} / ${status}`)
    return NextResponse.json({ received: true })

  } catch (err) {
    console.error('[webhook] Error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
