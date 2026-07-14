// ▸ Place at: app/api/profile/me/route.ts
// GET — the caller's own handle, auto-provisioning one if they don't have it
// yet (e.g. they've never posted to Community). Used by the "my profile" nav
// link, which navigates to /u?me=1 and gets redirected to the real handle.

import { auth }              from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { getOrCreateHandle } from '@/lib/profile'
import { logError }          from '@/lib/log-error'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const handle = await getOrCreateHandle(userId)
    return NextResponse.json({ handle })
  } catch (err) {
    logError('[GET /api/profile/me]', err)
    return NextResponse.json({ error: 'Failed to load your profile.' }, { status: 500 })
  }
}
