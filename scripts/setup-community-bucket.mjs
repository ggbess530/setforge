// ▸ Run once: node scripts/setup-community-bucket.mjs
// Creates the public 'community-audio' Storage bucket used by the Community
// mix-upload feature. Idempotent — safe to re-run (skips if the bucket exists).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Plain node script, not run through Next.js — .env.local isn't auto-loaded, so parse it by hand.
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const BUCKET = 'community-audio'
// Top of the two tier caps (free: 8MB / pro,team: 15MB) — the bucket ceiling is
// enforced by Supabase itself; per-tier limits are enforced in the upload-url route.
const FILE_SIZE_LIMIT = '15MB'
const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac']

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: existing } = await supabase.storage.getBucket(BUCKET)
if (existing) {
  console.log(`Bucket "${BUCKET}" already exists — skipping create, leaving its config as-is.`)
} else {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: FILE_SIZE_LIMIT,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  })
  if (error) { console.error('Failed to create bucket:', error.message); process.exit(1) }
  console.log(`Created public bucket "${BUCKET}" (limit ${FILE_SIZE_LIMIT}, audio MIME types only).`)
}
