// ▸ Place at: app/api/team/invite/item/route.ts
// DELETE /api/team/invite/item?id=xxx — owner revokes a pending invite.
// Query param, not a [id] folder — Windows/git issue documented in CLAUDE.md.

import { auth }              from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getOwnedTeam }      from '@/lib/team'
import { logError }          from '@/lib/log-error'

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const team = await getOwnedTeam(userId)
    if (!team) return NextResponse.json({ error: 'You do not own a team.' }, { status: 403 })

    const db = createAdminClient()
    const { error } = await db.from('team_invites').delete().eq('id', id).eq('team_id', team.id)
    if (error) throw error

    return NextResponse.json({ revoked: true })

  } catch (err) {
    logError('[DELETE /api/team/invite/item]', err)
    return NextResponse.json({ error: 'Failed to revoke invite.' }, { status: 500 })
  }
}
