// ▸ Place at: app/api/team/route.ts
// GET — full team status for the current user: which team (if any) they're
// on, their role, the roster, seat usage, and (owner-only) pending invites,
// or (no-team) a pending invite waiting for their email to accept.

import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getOwnedTeam, SEAT_LIMIT } from '@/lib/team'
import { checkSubscription } from '@/lib/subscription'
import { logError }          from '@/lib/log-error'

function summarizeUser(u: { id: string; fullName: string | null; username: string | null; imageUrl: string }) {
  return { userId: u.id, name: u.fullName || u.username || 'DJ', imageUrl: u.imageUrl }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createAdminClient()
    const client = await clerkClient()

    const mySub = await checkSubscription(userId)
    const owned = await getOwnedTeam(userId)

    // ── Owner or member of an existing team ─────────────────
    const { data: myMembership } = await db.from('team_members').select('team_id').eq('user_id', userId).maybeSingle()
    const team = owned ?? (myMembership
      ? await db.from('teams').select('id, name, owner_id, seat_limit').eq('id', myMembership.team_id).single().then(r => r.data && { id: r.data.id, name: r.data.name, ownerId: r.data.owner_id, seatLimit: r.data.seat_limit })
      : null)

    if (team) {
      const role = owned ? 'owner' : 'member'
      const { data: memberRows } = await db.from('team_members').select('user_id, joined_at').eq('team_id', team.id).order('joined_at')
      const memberIds = [team.ownerId, ...(memberRows ?? []).map(m => m.user_id)]
      const { data: clerkUsers } = await client.users.getUserList({ userId: memberIds })
      const byId = new Map(clerkUsers.map(u => [u.id, summarizeUser(u)]))

      const members = [
        { ...byId.get(team.ownerId), role: 'owner' as const, joinedAt: null as string | null },
        ...(memberRows ?? []).map(m => ({ ...byId.get(m.user_id), role: 'member' as const, joinedAt: m.joined_at })),
      ]

      let pendingInvites: { id: string; email: string; createdAt: string }[] = []
      if (role === 'owner') {
        const { data: invites } = await db.from('team_invites').select('id, email, created_at').eq('team_id', team.id).eq('status', 'pending').order('created_at')
        pendingInvites = (invites ?? []).map(i => ({ id: i.id, email: i.email, createdAt: i.created_at }))
      }

      return NextResponse.json({
        role, team: { id: team.id, name: team.name, seatLimit: team.seatLimit },
        members, pendingInvites,
        seatsUsed: members.length, seatLimit: team.seatLimit,
        pendingInviteForMe: null, myTier: mySub.tier,
      })
    }

    // ── Not on a team — check if my email has a pending invite waiting ──
    const me = await currentUser()
    const myEmails = (me?.emailAddresses ?? []).map(e => e.emailAddress.toLowerCase())
    let pendingInviteForMe = null
    if (myEmails.length) {
      const { data: invite } = await db
        .from('team_invites')
        .select('id, team_id, invited_by')
        .in('email', myEmails)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (invite) {
        const { data: inviteTeam } = await db.from('teams').select('name').eq('id', invite.team_id).single()
        const inviter = await client.users.getUser(invite.invited_by).catch(() => null)
        pendingInviteForMe = {
          teamName:   inviteTeam?.name ?? 'a team',
          invitedBy:  inviter ? (inviter.fullName || inviter.username || 'a DJ') : 'a DJ',
        }
      }
    }

    return NextResponse.json({
      role: null, team: null, members: [], pendingInvites: [],
      seatsUsed: 0, seatLimit: SEAT_LIMIT, pendingInviteForMe, myTier: mySub.tier,
    })

  } catch (err) {
    logError('[GET /api/team]', err)
    return NextResponse.json({ error: 'Failed to load team.' }, { status: 500 })
  }
}
