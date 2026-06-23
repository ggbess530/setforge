import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { checkSubscription } from '@/lib/subscription'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const sub = await checkSubscription(userId)
    return NextResponse.json({
      tier:      sub.tier,
      remaining: sub.remainingGenerations === null ? 'unlimited' : sub.remainingGenerations,
      trial:     sub.trial ?? null,
      isFree:    sub.isFree ?? false,
    })
  } catch (err) {
    console.error('[GET /api/quota]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
