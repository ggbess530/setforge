// ▸ Create folder: app/api/library/item/
// ▸ Place at:      app/api/library/item/route.ts
// ▸ DELETE the old app/api/library/[id]/ folder entirely

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getMyTeamId }  from '@/lib/team'
import { logError } from '@/lib/log-error'

function getId(req: Request): string | null {
  return new URL(req.url).searchParams.get('id')
}

// GET /api/library/item?id=xxx — load full set (your own, or one a teammate shared to your team)
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = getId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db = createAdminClient()
    const { data: set, error } = await db.from('sets').select('*').eq('id', id).single()
    if (error || !set) return NextResponse.json({ error: 'Set not found.' }, { status: 404 })

    if (set.user_id !== userId) {
      const teamId = set.shared_to_team_id && await getMyTeamId(userId)
      if (!teamId || teamId !== set.shared_to_team_id) {
        return NextResponse.json({ error: 'Set not found.' }, { status: 404 })
      }
    }

    return NextResponse.json({ set })

  } catch (err) {
    logError('[GET /api/library/item]', err)
    return NextResponse.json({ error: 'Failed to load set.' }, { status: 500 })
  }
}

// PATCH /api/library/item?id=xxx — rename set, and/or toggle team sharing
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = getId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { title, shareToTeam } = await req.json()
    if (title === undefined && shareToTeam === undefined) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }
    if (title !== undefined && !title.trim()) {
      return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) patch.title = title.trim()
    if (shareToTeam !== undefined) {
      if (shareToTeam) {
        const teamId = await getMyTeamId(userId)
        if (!teamId) return NextResponse.json({ error: 'You are not on a team.' }, { status: 403 })
        patch.shared_to_team_id = teamId
      } else {
        patch.shared_to_team_id = null
      }
    }

    const db = createAdminClient()
    const { data: updated, error } = await db
      .from('sets')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, title, updated_at, shared_to_team_id')
      .single()

    if (error || !updated) return NextResponse.json({ error: 'Set not found.' }, { status: 404 })
    return NextResponse.json({ set: updated })

  } catch (err) {
    logError('[PATCH /api/library/item]', err)
    return NextResponse.json({ error: 'Failed to update set.' }, { status: 500 })
  }
}

// DELETE /api/library/item?id=xxx
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = getId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db = createAdminClient()
    const { error } = await db
      .from('sets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return NextResponse.json({ deleted: true })

  } catch (err) {
    logError('[DELETE /api/library/item]', err)
    return NextResponse.json({ error: 'Failed to delete set.' }, { status: 500 })
  }
}