// ▸ Place at: app/api/team/sets/route.ts
// GET — sets any teammate (including the caller) has shared to the current
// user's team. Read-only list; loading the full set still goes through the
// existing /api/library/item?id= (owner-scoped) — see note on GET below.

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getMyTeamId }       from '@/lib/team'
import { logError }          from '@/lib/log-error'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const teamId = await getMyTeamId(userId)
    if (!teamId) return NextResponse.json({ sets: [] })

    const db = createAdminClient()
    const { data: sets, error } = await db
      .from('sets')
      .select('id, user_id, title, meta, created_at, updated_at')
      .eq('shared_to_team_id', teamId)
      .order('updated_at', { ascending: false })
    if (error) throw error

    const client = await clerkClient()
    const sharerIds = [...new Set((sets ?? []).map(s => s.user_id))]
    const { data: clerkUsers } = sharerIds.length ? await client.users.getUserList({ userId: sharerIds }) : { data: [] }
    const nameById = new Map(clerkUsers.map(u => [u.id, u.fullName || u.username || 'DJ']))

    const enriched = (sets ?? []).map(s => ({
      id: s.id, title: s.title, meta: s.meta, createdAt: s.created_at, updatedAt: s.updated_at,
      sharedBy: nameById.get(s.user_id) ?? 'DJ', isOwn: s.user_id === userId,
    }))

    return NextResponse.json({ sets: enriched })

  } catch (err) {
    logError('[GET /api/team/sets]', err)
    return NextResponse.json({ error: 'Failed to load team sets.' }, { status: 500 })
  }
}
