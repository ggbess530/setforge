// ▸ Place at: lib/profile.ts
// Public profile handles — auto-provisioned the first time a user posts to
// Community or visits their own profile, never a signup-time step. No
// customization UI yet; just a stable, URL-safe slug derived from their Clerk
// username/name.

import { createAdminClient } from './supabase'
import { clerkClient } from '@clerk/nextjs/server'

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'dj'
}

export async function getOrCreateHandle(userId: string): Promise<string> {
  const db = createAdminClient()
  const { data: existing } = await db.from('profile_handles').select('handle').eq('user_id', userId).maybeSingle()
  if (existing) return existing.handle

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const base = slugify(user.username || user.fullName || 'dj')

  let handle = base
  for (let attempt = 0; attempt < 20; attempt++) {
    const { error } = await db.from('profile_handles').insert({ user_id: userId, handle })
    if (!error) return handle
    if (error.code !== '23505') throw error   // not a uniqueness conflict — real error, don't retry
    handle = `${base}-${Math.floor(Math.random() * 10000)}`
  }
  throw new Error('Failed to allocate a profile handle')
}

// Read-only — does NOT provision. Used when linking to an arbitrary author
// from a context where we can't/shouldn't write (e.g. rendering a feed).
export async function getExistingHandle(userId: string): Promise<string | null> {
  const db = createAdminClient()
  const { data } = await db.from('profile_handles').select('handle').eq('user_id', userId).maybeSingle()
  return data?.handle ?? null
}

export async function getUserIdForHandle(handle: string): Promise<string | null> {
  const db = createAdminClient()
  const { data } = await db.from('profile_handles').select('user_id').eq('handle', handle).maybeSingle()
  return data?.user_id ?? null
}
