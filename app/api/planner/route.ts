// ▸ Create: app/api/planner/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient as db } from '@/lib/supabase'
import { logError } from '@/lib/log-error'

// GET — list saved nights
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await db()
      .from('planner_nights')
      .select('id, name, date, venue, slots, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return NextResponse.json({ nights: data || [] })
  } catch (err) {
    logError('[GET /api/planner]', err)
    return NextResponse.json({ error: 'Failed to load.' }, { status: 500 })
  }
}

// POST — save/upsert a night
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, name, date, venue, slots } = await req.json()
    const client = db()
    if (id) {
      const { data, error } = await client
        .from('planner_nights')
        .update({ name, date, venue, slots, updated_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', userId).select().single()
      if (error) throw error
      return NextResponse.json({ night: data })
    } else {
      const { data, error } = await client
        .from('planner_nights')
        .insert({ user_id: userId, name, date, venue, slots })
        .select().single()
      if (error) throw error
      return NextResponse.json({ night: data })
    }
  } catch (err) {
    logError('[POST /api/planner]', err)
    return NextResponse.json({ error: 'Failed to save.' }, { status: 500 })
  }
}

// DELETE — remove a night
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
    await db().from('planner_nights').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ deleted: true })
  } catch (err) {
    logError('[DELETE /api/planner]', err)
    return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 })
  }
}
