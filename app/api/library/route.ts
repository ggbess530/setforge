// ▸ Place at: app/api/library/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkSubscription } from '@/lib/subscription'
import { getMyTeamId }  from '@/lib/team'
import { logError } from '@/lib/log-error'

// ── GET /api/library — fetch all sets for the current user ────
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createAdminClient()

    const { data: sets, error } = await db
      .from('sets')
      .select('id, title, meta, created_at, updated_at, shared_to_team_id, is_public, share_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    // Return lightweight index — set_data is not included here
    // (only fetched when the user clicks Load, see /api/library/[id])
    return NextResponse.json({ sets: sets ?? [] })

  } catch (err) {
    logError('[GET /api/library]', err)
    return NextResponse.json({ error: 'Failed to load library.' }, { status: 500 })
  }
}

// ── POST /api/library — save a set ───────────────────────────
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only active subscribers can save sets
    const sub = await checkSubscription(userId)
    if (!sub.active) {
      return NextResponse.json({ error: 'No active subscription.' }, { status: 403 })
    }

    const { title, setData, meta, shareToTeam } = await req.json()

    if (!title || !setData) {
      return NextResponse.json({ error: 'Missing title or set data.' }, { status: 400 })
    }

    const db = createAdminClient()
    const teamId = shareToTeam ? await getMyTeamId(userId) : null

    const { data: saved, error } = await db
      .from('sets')
      .insert({
        user_id:  userId,
        title:    title.trim(),
        set_data: setData,
        meta:     meta ?? {},
        shared_to_team_id: teamId,
      })
      .select('id, title, meta, created_at, shared_to_team_id, is_public, share_id')
      .single()

    if (error) throw error

    return NextResponse.json({ set: saved }, { status: 201 })

  } catch (err) {
    logError('[POST /api/library]', err)
    return NextResponse.json({ error: 'Failed to save set.' }, { status: 500 })
  }
}
