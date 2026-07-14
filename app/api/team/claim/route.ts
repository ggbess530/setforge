// ▸ Place at: app/api/team/claim/route.ts
// POST /api/team/claim — accept the pending invite matching one of the
// current user's verified emails. Explicit accept (not silent auto-join) so
// nobody gets merged into someone else's subscription without confirming.

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getOwnedTeam }      from '@/lib/team'
import { logError }          from '@/lib/log-error'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { decline } = await req.json().catch(() => ({ decline: false }))
    const db = createAdminClient()

    const me = await currentUser()
    const myEmails = (me?.emailAddresses ?? []).map(e => e.emailAddress.toLowerCase())
    if (!myEmails.length) return NextResponse.json({ error: 'No verified email on your account.' }, { status: 400 })

    const { data: invite } = await db
      .from('team_invites')
      .select('id, team_id')
      .in('email', myEmails)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (!invite) return NextResponse.json({ error: 'No pending invite found for your email.' }, { status: 404 })

    if (decline) {
      await db.from('team_invites').update({ status: 'revoked' }).eq('id', invite.id)
      return NextResponse.json({ declined: true })
    }

    const { data: existingMembership } = await db.from('team_members').select('id').eq('user_id', userId).maybeSingle()
    if (existingMembership) return NextResponse.json({ error: 'You are already on a team — leave it first.' }, { status: 409 })
    if (await getOwnedTeam(userId)) return NextResponse.json({ error: 'You already own a team.' }, { status: 409 })

    const { error: joinErr } = await db.from('team_members').insert({ team_id: invite.team_id, user_id: userId })
    if (joinErr) throw joinErr

    await db.from('team_invites').update({ status: 'accepted' }).eq('id', invite.id)

    return NextResponse.json({ joined: true })

  } catch (err) {
    logError('[POST /api/team/claim]', err)
    return NextResponse.json({ error: 'Failed to join team.' }, { status: 500 })
  }
}
