// ▸ Create folder: app/api/library/item/
// ▸ Place at:      app/api/library/item/route.ts
// ▸ DELETE the old app/api/library/[id]/ folder entirely

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function getId(req: Request): string | null {
  return new URL(req.url).searchParams.get('id')
}

// GET /api/library/item?id=xxx — load full set
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = getId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db = createAdminClient()
    const { data: set, error } = await db
      .from('sets')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !set) return NextResponse.json({ error: 'Set not found.' }, { status: 404 })
    return NextResponse.json({ set })

  } catch (err) {
    console.error('[GET /api/library/item]', err)
    return NextResponse.json({ error: 'Failed to load set.' }, { status: 500 })
  }
}

// PATCH /api/library/item?id=xxx — rename set
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = getId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { title } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 })

    const db = createAdminClient()
    const { data: updated, error } = await db
      .from('sets')
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, title, updated_at')
      .single()

    if (error || !updated) return NextResponse.json({ error: 'Set not found.' }, { status: 404 })
    return NextResponse.json({ set: updated })

  } catch (err) {
    console.error('[PATCH /api/library/item]', err)
    return NextResponse.json({ error: 'Failed to rename set.' }, { status: 500 })
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
    console.error('[DELETE /api/library/item]', err)
    return NextResponse.json({ error: 'Failed to delete set.' }, { status: 500 })
  }
}