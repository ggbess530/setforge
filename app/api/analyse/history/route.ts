// ▸ Place at: app/api/analyse/history/route.ts

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

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await db()
      .from('set_analyses')
      .select('grade, track_count, context, scores, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json({ analyses: data || [] })

  } catch (err) {
    console.error('[GET /api/analyse/history]', err)
    return NextResponse.json({ error: 'Failed to load history.' }, { status: 500 })
  }
}
