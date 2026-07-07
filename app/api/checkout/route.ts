// ▸ Create folder: app/api/checkout/
// ▸ Place at:      app/api/checkout/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/log-error'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tier } = await req.json()

    const variantId = tier === 'team'
      ? process.env.LEMON_SQUEEZY_VARIANT_TEAM
      : process.env.LEMON_SQUEEZY_VARIANT_PRO

    if (!variantId) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    }

    const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
        'Content-Type':  'application/vnd.api+json',
        'Accept':        'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_options: {
              embed:          false,
              media:          false,
              logo:           true,
              desc:           true,
              discount:       true,
              button_color:   '#00f0ff',
            },
            checkout_data: {
              custom: {
                user_id: userId,  // passed back in webhook
              },
            },
            product_options: {
              redirect_url:       'https://setforge.online/app?upgraded=true',
              receipt_thank_you_note: 'Thank you for upgrading to SetForge Pro — it genuinely means a lot.\n\nYou now have unlimited set generations, full library import, custom energy curves, and everything else Pro has to offer. No limits, no restrictions — just build.\n\nIf you ever run into anything or have an idea for a feature you\'d love to see, reply to this email directly. I read every one.\n\nNow go forge something great.\n\nGarrett\nFounder, SetForge',
              receipt_button_text: 'Open SetForge',
              receipt_link_url:    'https://setforge.online/app',
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: process.env.LEMON_SQUEEZY_STORE_ID }
            },
            variant: {
              data: { type: 'variants', id: variantId }
            },
          },
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      logError('[checkout] LS error:', JSON.stringify(data))
      return NextResponse.json({ error: 'Failed to create checkout.' }, { status: 500 })
    }

    const checkoutUrl = data?.data?.attributes?.url
    if (!checkoutUrl) {
      return NextResponse.json({ error: 'No checkout URL returned.' }, { status: 500 })
    }

    return NextResponse.json({ url: checkoutUrl })

  } catch (err) {
    logError('[POST /api/checkout]', err)
    return NextResponse.json({ error: 'Checkout failed.' }, { status: 500 })
  }
}
