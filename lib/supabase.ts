import { createClient } from '@supabase/supabase-js'

// Service-role client bypasses Row Level Security.
// Only ever instantiated inside API routes — never on the client side.
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  )
}

// Full, current schema lives in CLAUDE.md ("Supabase Schema") — don't
// duplicate it here, it just drifts out of sync with reality.
