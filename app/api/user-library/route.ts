// ▸ Create folder: app/api/user-library/
// ▸ Place at:      app/api/user-library/route.ts

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

// ── GET — fetch the user's full library (crates + tracks) ─────
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = db()
    const url    = new URL(req.url)
    const crateId = url.searchParams.get('crateId')

    // Fetch crates
    const { data: crates, error: crateErr } = await client
      .from('user_crates')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')

    if (crateErr) throw crateErr

    // If crateId specified, return tracks for that crate only
    if (crateId) {
      // '__all__' → return every track the user owns, regardless of crate membership.
      // Tracks saved from sets (source='setforge') have no crate assignments, so
      // going through user_crate_tracks would miss them entirely.
      if (crateId === '__all__') {
        const { data: allTracks, error: allErr } = await client
          .from('user_tracks')
          .select('*')
          .eq('user_id', userId)
          .order('artist')
        if (allErr) throw allErr
        return NextResponse.json({ tracks: allTracks || [] })
      }

      // Specific crate → walk subtree then look up via membership table
      const allCrates = crates || []
      function getSubtreeIds(id: string): string[] {
        const ids = [id]
        allCrates
          .filter(c => c.parent_id === id)
          .forEach(child => ids.push(...getSubtreeIds(child.crate_id)))
        return ids
      }
      const subtreeIds = getSubtreeIds(crateId)

      const { data: memberships } = await client
        .from('user_crate_tracks')
        .select('track_id')
        .eq('user_id', userId)
        .in('crate_id', subtreeIds)

      const trackIds = [...new Set((memberships || []).map(m => m.track_id))]
      if (trackIds.length === 0) return NextResponse.json({ tracks: [] })

      const { data: tracks, error: trackErr } = await client
        .from('user_tracks')
        .select('*')
        .eq('user_id', userId)
        .in('track_id', trackIds)
        .order('artist')

      if (trackErr) throw trackErr
      return NextResponse.json({ tracks: tracks || [] })
    }

    // Return full library stats
    const { count: trackCount } = await client
      .from('user_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return NextResponse.json({ crates: crates || [], trackCount: trackCount || 0 })

  } catch (err) {
    console.error('[GET /api/user-library]', err)
    return NextResponse.json({ error: 'Failed to load library.' }, { status: 500 })
  }
}

// ── POST — save/merge an imported library ─────────────────────
// Body: { source, tracks: [...], crates: [...], crateTracks: {...} }
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { source, tracks, crates, crateTracks } = await req.json()

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks to save.' }, { status: 400 })
    }

    const client = db()

    // ── Upsert tracks (merge, never delete existing) ──────────
    const trackRows = tracks.map((t: {
      id: string; title: string; artist: string;
      bpm?: number; key?: string; genre?: string; path?: string
    }) => ({
      user_id:    userId,
      track_id:   t.id,
      title:      t.title,
      artist:     t.artist,
      bpm:        t.bpm || null,
      key:        t.key || null,
      genre:      t.genre || null,
      path:       t.path || null,
      source:     source || 'manual',
      updated_at: new Date().toISOString(),
    }))

    // Batch upsert in chunks of 200
    for (let i = 0; i < trackRows.length; i += 200) {
      const batch = trackRows.slice(i, i + 200)
      const { error } = await client
        .from('user_tracks')
        .upsert(batch, { onConflict: 'user_id,track_id', ignoreDuplicates: false })
      if (error) throw error
    }

    // ── Upsert crates ─────────────────────────────────────────
    if (Array.isArray(crates) && crates.length > 0) {
      const crateRows = crates.map((c: {
        id: string; name: string; fullPath: string;
        parentId?: string; isFolder: boolean; sortOrder?: number
      }, i: number) => ({
        user_id:    userId,
        crate_id:   c.id,
        name:       c.name,
        full_path:  c.fullPath,
        parent_id:  c.parentId || null,
        is_folder:  c.isFolder,
        source:     source || 'manual',
        sort_order: c.sortOrder ?? i,
      }))

      for (let i = 0; i < crateRows.length; i += 200) {
        const { error } = await client
          .from('user_crates')
          .upsert(crateRows.slice(i, i + 200), { onConflict: 'user_id,crate_id', ignoreDuplicates: false })
        if (error) throw error
      }
    }

    // ── Upsert crate-track memberships ────────────────────────
    if (crateTracks && typeof crateTracks === 'object') {
      const memberRows: { user_id:string; crate_id:string; track_id:string; sort_order:number }[] = []
      Object.entries(crateTracks).forEach(([crateId, trackIds]) => {
        (trackIds as string[]).forEach((trackId, i) => {
          memberRows.push({ user_id: userId, crate_id: crateId, track_id: trackId, sort_order: i })
        })
      })
      for (let i = 0; i < memberRows.length; i += 500) {
        const { error } = await client
          .from('user_crate_tracks')
          .upsert(memberRows.slice(i, i + 500), { onConflict: 'user_id,crate_id,track_id', ignoreDuplicates: true })
        if (error) throw error
      }
    }

    return NextResponse.json({
      saved: true,
      trackCount: tracks.length,
      crateCount: crates?.length || 0,
    })

  } catch (err) {
    console.error('[POST /api/user-library]', err)
    return NextResponse.json({ error: 'Failed to save library.' }, { status: 500 })
  }
}

// ── DELETE — clear the user's entire library ──────────────────
export async function DELETE() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = db()
    await client.from('user_crate_tracks').delete().eq('user_id', userId)
    await client.from('user_crates').delete().eq('user_id', userId)
    await client.from('user_tracks').delete().eq('user_id', userId)

    return NextResponse.json({ cleared: true })
  } catch (err) {
    console.error('[DELETE /api/user-library]', err)
    return NextResponse.json({ error: 'Failed to clear library.' }, { status: 500 })
  }
}
