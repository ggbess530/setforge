// ▸ Place at: app/api/team/invite/route.ts
// POST — Team-tier owner invites a teammate by email. Creates the team row on
// first invite (lazy — a Team subscriber who never invites anyone never gets
// a teams row). No email is actually sent (no email provider in this stack) —
// the owner shares the news out of band; the teammate signs in with that
// exact email and accepts from /team.

import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import { NextResponse }       from 'next/server'
import { createAdminClient }  from '@/lib/supabase'
import { getOwnedTeam, SEAT_LIMIT } from '@/lib/team'
import { notify }             from '@/lib/notifications'
import { logError }           from '@/lib/log-error'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email } = await req.json()
    const cleanEmail = String(email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(cleanEmail)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

    const db = createAdminClient()

    // Must be riding their OWN paid Team subscription — not a member riding
    // someone else's (checkSubscription's team pass-through would otherwise
    // make an invited member look "team tier" too).
    const { data: mySub } = await db.from('subscriptions').select('tier, status').eq('user_id', userId).maybeSingle()
    if (mySub?.tier !== 'team' || mySub?.status !== 'active') {
      return NextResponse.json({ error: 'Team invites require an active Team plan subscription.' }, { status: 403 })
    }

    let team = await getOwnedTeam(userId)
    if (!team) {
      const { data: created, error } = await db.from('teams').insert({ owner_id: userId }).select('id, name, owner_id, seat_limit').single()
      if (error) throw error
      team = { id: created.id, name: created.name, ownerId: created.owner_id, seatLimit: created.seat_limit }
    }

    const [{ count: memberCount }, { count: inviteCount }] = await Promise.all([
      db.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', team.id),
      db.from('team_invites').select('*', { count: 'exact', head: true }).eq('team_id', team.id).eq('status', 'pending'),
    ])
    const occupied = 1 + (memberCount ?? 0) + (inviteCount ?? 0)   // +1 for the owner
    if (occupied >= (team.seatLimit || SEAT_LIMIT)) {
      return NextResponse.json({ error: `Seat limit reached (${team.seatLimit || SEAT_LIMIT}). Remove a member or pending invite first.` }, { status: 400 })
    }

    const { data: invite, error } = await db
      .from('team_invites')
      .insert({ team_id: team.id, email: cleanEmail, invited_by: userId })
      .select('id, email, created_at')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'That email already has a pending invite.' }, { status: 409 })
      throw error
    }

    // If the invitee already has a SetForge account, notify them immediately
    // instead of waiting for them to stumble onto /team on their own.
    const client = await clerkClient()
    const { data: existingUsers } = await client.users.getUserList({ emailAddress: [cleanEmail] })
    if (existingUsers[0]) {
      const inviter = await currentUser()
      const inviterName = inviter?.fullName || inviter?.username || 'A DJ'
      await notify({
        userId: existingUsers[0].id, type: 'team_invite',
        actorName: inviterName, actorImage: inviter?.imageUrl,
        message: `${inviterName} invited you to join their team`, link: '/team',
      })
    }

    return NextResponse.json({ invite }, { status: 201 })

  } catch (err) {
    logError('[POST /api/team/invite]', err)
    return NextResponse.json({ error: 'Failed to send invite.' }, { status: 500 })
  }
}
