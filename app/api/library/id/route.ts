// ▸ Place at: app/api/library/[id]/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

type Params = { params: { id: string } }

// ── GET /api/library/[id] — load full set data ────────────────
export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createAdminClient()

    const { data: set, error } = await db
      .from('sets')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)   // ensures users can only read their own sets
      .single()

    if (error || !set) {
      return NextResponse.json({ error: 'Set not found.' }, { status: 404 })
    }

    return NextResponse.json({ set })

  } catch (err) {
    console.error('[GET /api/library/[id]]', err)
    return NextResponse.json({ error: 'Failed to load set.' }, { status: 500 })
  }
}

// ── PATCH /api/library/[id] — rename a set ────────────────────
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title } = await req.json()
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 })
    }

    const db = createAdminClient()

    const { data: updated, error } = await db
      .from('sets')
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', userId)
      .select('id, title, updated_at')
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: 'Set not found.' }, { status: 404 })
    }

    return NextResponse.json({ set: updated })

  } catch (err) {
    console.error('[PATCH /api/library/[id]]', err)
    return NextResponse.json({ error: 'Failed to rename set.' }, { status: 500 })
  }
}

// ── DELETE /api/library/[id] — delete a set ───────────────────
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createAdminClient()

    const { error } = await db
      .from('sets')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ deleted: true })

  } catch (err) {
    console.error('[DELETE /api/library/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete set.' }, { status: 500 })
  }
}
