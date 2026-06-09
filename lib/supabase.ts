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

// ─────────────────────────────────────────────
// Supabase schema (run this SQL in your dashboard)
// ─────────────────────────────────────────────
//
// -- Stores Lemon Squeezy subscription state per user
// CREATE TABLE subscriptions (
//   id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id            text NOT NULL UNIQUE,   -- Clerk user ID
//   tier               text NOT NULL DEFAULT 'starter',
//   status             text NOT NULL DEFAULT 'inactive',
//   ls_subscription_id text,
//   ls_customer_id     text,
//   updated_at         timestamptz DEFAULT now()
// );
//
// -- Stores saved DJ sets
// CREATE TABLE sets (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id    text NOT NULL,
//   title      text NOT NULL,
//   set_data   jsonb NOT NULL,
//   meta       jsonb,
//   created_at timestamptz DEFAULT now(),
//   updated_at timestamptz DEFAULT now()
// );
// CREATE INDEX sets_user_id_idx ON sets (user_id);
//
// -- Tracks API usage for rate limiting
// CREATE TABLE usage (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id    text NOT NULL,
//   action     text NOT NULL,   -- 'generate' | 'swap'
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX usage_user_action_idx ON usage (user_id, action, created_at);
