// ▸ Place at: app/api/community/mixes/upload-url/route.ts
// POST — quota + file checks, then hands back a Supabase signed upload URL so
// the audio blob goes straight from the browser to Storage. Keeps large audio
// files off the Vercel serverless request path entirely (well past its ~4.5MB
// body limit for a 15MB mix — this route's own JSON body is tiny).
// Body: { contentType, fileSizeBytes, durationSec }

import { auth }                 from '@clerk/nextjs/server'
import { NextResponse }         from 'next/server'
import { createAdminClient }    from '@/lib/supabase'
import { checkMixUploadQuota }  from '@/lib/subscription'
import { logError }             from '@/lib/log-error'

const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/aac': 'aac', 'audio/flac': 'flac',
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { contentType, fileSizeBytes, durationSec } = await req.json()
    const ext = EXT_BY_MIME[contentType]
    if (!ext) return NextResponse.json({ error: 'Unsupported audio format. Use MP3, WAV, M4A, OGG, or FLAC.' }, { status: 400 })
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return NextResponse.json({ error: 'Invalid file.' }, { status: 400 })
    }

    const quota = await checkMixUploadQuota(userId)
    if (!quota.allowed) {
      return NextResponse.json({ error: 'You’ve used all your mix uploads. Upgrade to Pro for more.', code: 'LIMIT_REACHED' }, { status: 429 })
    }
    if (fileSizeBytes > quota.maxFileBytes) {
      return NextResponse.json({ error: `File too large — max ${Math.round(quota.maxFileBytes / 1024 / 1024)}MB on your plan.` }, { status: 400 })
    }
    if (durationSec && durationSec > quota.maxDurationSec) {
      return NextResponse.json({ error: `Clip too long — max ${Math.round(quota.maxDurationSec / 60)} minutes on your plan.` }, { status: 400 })
    }

    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const db = createAdminClient()
    const { data, error } = await db.storage.from('community-audio').createSignedUploadUrl(path)
    if (error) throw error

    return NextResponse.json({ path, token: data.token, bucket: 'community-audio' })

  } catch (err) {
    logError('[POST /api/community/mixes/upload-url]', err)
    return NextResponse.json({ error: 'Failed to prepare upload.' }, { status: 500 })
  }
}
