// ▸ Place at: app/api/team/member/route.ts
// DELETE /api/team/member?userId=xxx — remove a teammate (owner-only, unless
// userId matches the caller, which is a member leaving on their own).
// No "delete team" route needed: if the owner's subscription lapses,
// getRiddenTeam() in lib/team.ts stops granting access on its own.

import { auth }              from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getOwnedTeam }      from '@/lib/team'
import { logError }          from '@/lib/log-error'

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const targetUserId = new URL(req.url).searchParams.get('userId')
    if (!targetUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const db = createAdminClient()

    if (targetUserId === userId) {
      // Leaving on your own
      const { error } = await db.from('team_members').delete().eq('user_id', userId)
      if (error) throw error
      return NextResponse.json({ removed: true })
    }

    // Removing someone else — must own the team they're on
    const team = await getOwnedTeam(userId)
    if (!team) return NextResponse.json({ error: 'You do not own a team.' }, { status: 403 })

    const { error } = await db.from('team_members').delete().eq('user_id', targetUserId).eq('team_id', team.id)
    if (error) throw error
    return NextResponse.json({ removed: true })

  } catch (err) {
    logError('[DELETE /api/team/member]', err)
    return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 })
  }
}
