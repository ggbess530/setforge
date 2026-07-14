// ▸ Place at: app/api/community/mixes/route.ts
// POST — finalizes a mix post after the client has already uploaded the audio
// blob to Storage via the signed URL from /api/community/mixes/upload-url.
// Body: { path, title, body?, track1:{artist,title,bpm,key}, track2:{...}, durationSec, sizeBytes }

import { auth, currentUser }   from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createAdminClient }   from '@/lib/supabase'
import { checkMixUploadQuota } from '@/lib/subscription'
import { logError }            from '@/lib/log-error'

const MAX_TITLE   = 120
const MAX_CAPTION = 2000

function cleanTrack(t: unknown) {
  const track = (t ?? {}) as Record<string, unknown>
  const artist = String(track.artist ?? '').trim()
  const title  = String(track.title  ?? '').trim()
  if (!artist || !title) return null
  const bpm = Number(track.bpm)
  return {
    artist, title,
    bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : null,
    key: typeof track.key === 'string' ? track.key.trim().toUpperCase().slice(0, 4) : null,
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { path, title, body, track1: t1, track2: t2, durationSec, sizeBytes } = await req.json()

    if (typeof path !== 'string' || !path.startsWith(`${userId}/`)) {
      return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
    }
    if (!title?.trim())                    return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    if (title.trim().length > MAX_TITLE)   return NextResponse.json({ error: `Title must be ${MAX_TITLE} characters or fewer.` }, { status: 400 })
    if (body && body.length > MAX_CAPTION) return NextResponse.json({ error: `Caption must be ${MAX_CAPTION} characters or fewer.` }, { status: 400 })

    const track1 = cleanTrack(t1)
    const track2 = cleanTrack(t2)
    if (!track1 || !track2) return NextResponse.json({ error: 'Both track 1 and track 2 need an artist and title.' }, { status: 400 })

    // Re-check quota — the upload itself already happened, but a post shouldn't
    // land if the user's allowance ran out between the two requests (e.g. a
    // second tab finishing an upload at the same time).
    const quota = await checkMixUploadQuota(userId)
    if (!quota.allowed) {
      return NextResponse.json({ error: 'You’ve used all your mix uploads. Upgrade to Pro for more.', code: 'LIMIT_REACHED' }, { status: 429 })
    }

    const db = createAdminClient()

    // Confirm the object actually exists in Storage before creating a post that
    // points at it — the client reports path/size/duration itself, so this
    // guards against a post being created for an upload that never completed.
    const [, ...rest] = path.split('/')
    const objectName = rest.join('/')
    const { data: exists } = await db.storage.from('community-audio').list(userId, { search: objectName })
    if (!exists?.some(f => f.name === objectName)) {
      return NextResponse.json({ error: 'Upload not found — please try again.' }, { status: 400 })
    }

    const user = await currentUser()
    const { data: post, error } = await db
      .from('community_posts')
      .insert({
        user_id:            userId,
        author_name:        user?.fullName || user?.username || 'DJ',
        author_image:       user?.imageUrl || null,
        type:               'mix',
        title:              title.trim(),
        body:               body?.trim() || null,
        track1_artist:      track1.artist, track1_title: track1.title, track1_bpm: track1.bpm, track1_key: track1.key,
        track2_artist:      track2.artist, track2_title: track2.title, track2_bpm: track2.bpm, track2_key: track2.key,
        audio_path:         path,
        audio_duration_sec: Number.isFinite(durationSec) ? Math.round(durationSec) : null,
        audio_size_bytes:   Number.isFinite(sizeBytes)   ? Math.round(sizeBytes)   : null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ post }, { status: 201 })

  } catch (err) {
    logError('[POST /api/community/mixes]', err)
    return NextResponse.json({ error: 'Failed to publish mix.' }, { status: 500 })
  }
}
