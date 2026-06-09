// ▸ Place at: app/api/webhooks/lemon-squeezy/route.ts

import { NextResponse } from 'next/server'
import crypto           from 'crypto'
import { createAdminClient } from '@/lib/supabase'

// Lemon Squeezy sends a signature header we verify to confirm the request
// is genuinely from them — not a spoofed call from someone else
function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
  if (!secret) throw new Error('LEMON_SQUEEZY_WEBHOOK_SECRET not set')

  const hmac    = crypto.createHmac('sha256', secret)
  const digest  = hmac.update(rawBody).digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  )
}

// Map Lemon Squeezy variant IDs → SetForge tier names
function variantToTier(variantId: number): string {
  const map: Record<string, string> = {
    [process.env.LEMON_SQUEEZY_VARIANT_STARTER ?? '']: 'starter',
    [process.env.LEMON_SQUEEZY_VARIANT_PRO     ?? '']: 'pro',
    [process.env.LEMON_SQUEEZY_VARIANT_AGENCY  ?? '']: 'agency',
  }
  return map[String(variantId)] ?? 'starter'
}

export async function POST(req: Request) {
  const rawBody  = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  // ── 1. Verify signature ───────────────────────────────────
  try {
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch (err) {
    console.error('[webhook] Signature verification failed', err)
    return NextResponse.json({ error: 'Signature check failed' }, { status: 500 })
  }

  const event = JSON.parse(rawBody)
  const eventName: string = event.meta?.event_name ?? ''
  const data              = event.data?.attributes ?? {}
  const customData        = event.meta?.custom_data ?? {}

  // We attach the Clerk userId as custom_data.user_id when creating
  // the checkout link (see /api/checkout/route.ts)
  const userId  = customData.user_id
  const subId   = event.data?.id
  const custId  = data.customer_id
  const variant = data.variant_id
  const status  = data.status  // 'active' | 'cancelled' | 'past_due' | 'paused' etc.

  if (!userId) {
    // No user ID attached — log and ignore gracefully
    console.warn('[webhook] Event received without user_id:', eventName)
    return NextResponse.json({ received: true })
  }

  const db   = createAdminClient()
  const tier = variantToTier(variant)

  // ── 2. Handle events ──────────────────────────────────────
  switch (eventName) {

    // New subscription created
    case 'subscription_created': {
      await db.from('subscriptions').upsert({
        user_id:            userId,
        tier,
        status:             'active',
        ls_subscription_id: subId,
        ls_customer_id:     custId,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'user_id' })

      console.log(`[webhook] New subscription: user=${userId} tier=${tier}`)
      break
    }

    // Subscription updated (e.g. upgrade from Starter → Pro)
    case 'subscription_updated': {
      const isActive = status === 'active'
      await db.from('subscriptions').upsert({
        user_id:            userId,
        tier,
        status:             isActive ? 'active' : 'inactive',
        ls_subscription_id: subId,
        ls_customer_id:     custId,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'user_id' })

      console.log(`[webhook] Subscription updated: user=${userId} tier=${tier} status=${status}`)
      break
    }

    // User cancelled (they still have access until period end — LS handles this)
    case 'subscription_cancelled': {
      await db.from('subscriptions').upsert({
        user_id:    userId,
        status:     'inactive',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      console.log(`[webhook] Subscription cancelled: user=${userId}`)
      break
    }

    // Payment failed — revoke access immediately
    case 'subscription_payment_failed': {
      await db.from('subscriptions').upsert({
        user_id:    userId,
        status:     'inactive',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      console.log(`[webhook] Payment failed: user=${userId}`)
      break
    }

    default:
      // Log unhandled events so you can add handlers as needed
      console.log(`[webhook] Unhandled event: ${eventName}`)
  }

  // Always return 200 quickly so LS doesn't retry
  return NextResponse.json({ received: true })
}
