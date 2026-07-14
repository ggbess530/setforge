// ▸ Place at: app/api/community/mixes/quota/route.ts
// GET — lets the composer show "2 mix uploads left" / disable the button
// before the user picks a file, instead of only failing at upload time.

import { auth }                from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { checkMixUploadQuota } from '@/lib/subscription'
import { logError }            from '@/lib/log-error'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const quota = await checkMixUploadQuota(userId)
    return NextResponse.json(quota)
  } catch (err) {
    logError('[GET /api/community/mixes/quota]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
