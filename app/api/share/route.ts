// ▸ Create folder: app/api/share/
// ▸ Place at:      app/api/share/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Generates a short, URL-safe share ID like "x7Kp2mQ9"
function makeShareId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let id = ''
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

// ── POST /api/share — create a share link for a saved set ────
// Body: { setId: string }
// Auth required — only the set's owner can share it
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { setId } = await req.json()
    if (!setId) return NextResponse.json({ error: 'Missing setId' }, { status: 400 })

    const client = db()

    // Verify ownership
    const { data: set, error } = await client
      .from('sets')
      .select('id, share_id')
      .eq('id', setId)
      .eq('user_id', userId)
      .single()

    if (error || !set) return NextResponse.json({ error: 'Set not found.' }, { status: 404 })

    // Already shared — return the existing link
    if (set.share_id) {
      return NextResponse.json({ shareId: set.share_id })
    }

    // Create a new share ID
    const shareId = makeShareId()
    const { error: updateError } = await client
      .from('sets')
      .update({ share_id: shareId, is_public: true })
      .eq('id', setId)
      .eq('user_id', userId)

    if (updateError) throw updateError

    return NextResponse.json({ shareId })

  } catch (err) {
    console.error('[POST /api/share]', err)
    return NextResponse.json({ error: 'Failed to create share link.' }, { status: 500 })
  }
}

// ── GET /api/share?id=xxx — fetch a shared set (PUBLIC) ───────
// No auth — anyone with the link can view
export async function GET(req: Request) {
  try {
    const shareId = new URL(req.url).searchParams.get('id')
    if (!shareId) return NextResponse.json({ error: 'Missing share id' }, { status: 400 })

    const client = db()
    const { data: set, error } = await client
      .from('sets')
      .select('title, set_data, meta, created_at')
      .eq('share_id', shareId)
      .eq('is_public', true)
      .single()

    if (error || !set) return NextResponse.json({ error: 'Set not found or no longer shared.' }, { status: 404 })

    return NextResponse.json({ set })

  } catch (err) {
    console.error('[GET /api/share]', err)
    return NextResponse.json({ error: 'Failed to load shared set.' }, { status: 500 })
  }
}

// ── DELETE /api/share?setId=xxx — unshare a set ───────────────
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const setId = new URL(req.url).searchParams.get('setId')
    if (!setId) return NextResponse.json({ error: 'Missing setId' }, { status: 400 })

    const client = db()
    const { error } = await client
      .from('sets')
      .update({ share_id: null, is_public: false })
      .eq('id', setId)
      .eq('user_id', userId)

    if (error) throw error
    return NextResponse.json({ unshared: true })

  } catch (err) {
    console.error('[DELETE /api/share]', err)
    return NextResponse.json({ error: 'Failed to unshare.' }, { status: 500 })
  }
}