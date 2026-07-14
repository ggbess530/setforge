# SetForge — Project Context for Claude Code

## What is SetForge
AI-powered DJ set creation SaaS at **setforge.online**. Users describe their genre, mood, crowd type, and energy arc — the AI generates a complete, professionally structured DJ set with BPM matching, harmonic key sequencing, and transition notes. Built for beginners who don't know music theory, through to professional DJs managing large libraries.

## Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Auth:** Clerk (production instance, domain verified)
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Payments:** Lemon Squeezy (store ID: 402701)
- **Deployment:** Vercel (GitHub → main branch auto-deploys)
- **Domain:** setforge.online (Namecheap DNS → Vercel)
- **Repo:** github.com/ggbess530/setforge (private)

## Environment Variables
```
ANTHROPIC_API_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY     # pk_live_ for production
CLERK_SECRET_KEY                       # sk_live_ for production
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/app
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/app
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LEMON_SQUEEZY_API_KEY
LEMON_SQUEEZY_WEBHOOK_SECRET
LEMON_SQUEEZY_STORE_ID=402701
LEMON_SQUEEZY_VARIANT_PRO=1820113
LEMON_SQUEEZY_VARIANT_TEAM=1820124
ADMIN_USER_IDS=user_xxx               # comma-separated Clerk user IDs for unlimited access
SPOTIFY_CLIENT_ID                      # same app creds, used for both Client Credentials (track verification) and Authorization Code (trend ingestion)
SPOTIFY_CLIENT_SECRET
SPOTIFY_REDIRECT_URI=https://setforge.online/api/admin/spotify/callback  # must exactly match the URI registered in the Spotify Developer Dashboard
CRON_SECRET                            # bearer token Vercel Cron sends; rejects unauthenticated hits to /api/cron/*
SENTRY_DSN                             # server/edge error reporting — unset means Sentry is a no-op, nothing breaks
NEXT_PUBLIC_SENTRY_DSN                 # same, for browser-side errors
```

## Key File Structure
```
app/
├── page.tsx                          # Landing page (beginner-friendly, animated)
├── app/
│   └── page.tsx                      # Main split-panel app (controls left, set right)
├── analyse/
│   └── page.tsx                      # Set analyser standalone page (/analyse)
├── s/
│   └── page.tsx                      # Public shared set page (/s?id=xxx)
├── admin/
│   └── page.tsx                      # Admin-only trending-tracks dashboard (status + manual refresh)
├── sign-in/[[...sign-in]]/page.tsx
├── sign-up/[[...sign-up]]/page.tsx
├── components/
│   ├── EnergyEditor.tsx              # Interactive SVG energy curve (5 draggable points)
│   ├── OnboardingWizard.tsx          # First-time user 5-step wizard
│   ├── UserLibrary.tsx               # Persistent library with crate browser
│   └── LibraryImporter.tsx           # One-time import (older, superseded by UserLibrary)
├── api/
│   ├── generate/route.ts             # Main set generation (chunked, history-aware)
│   ├── swap/route.ts                 # Hot-swap single track
│   ├── import/route.ts               # Build set from imported tracks (smart prefilter)
│   ├── analyse/
│   │   ├── route.ts                  # Set analysis (grade, scores, improvements)
│   │   ├── history/route.ts          # Past analyses
│   │   └── export/route.ts           # Export analysis as txt
│   ├── library/
│   │   ├── route.ts                  # GET list + POST save sets
│   │   └── item/route.ts             # GET/PATCH/DELETE single set (query params, no [id] folder)
│   ├── user-library/route.ts         # Persistent DJ library (tracks + crates)
│   ├── track-history/route.ts        # Track usage history
│   ├── why/route.ts                  # "Why this track" explanations
│   ├── share/route.ts                # Public set sharing
│   ├── checkout/route.ts             # Lemon Squeezy checkout URL creation
│   ├── webhooks/lemon-squeezy/route.ts  # Subscription webhook handler
│   ├── cron/refresh-trends/route.ts  # Daily Vercel Cron — refreshes trending_tracks (CRON_SECRET-gated)
│   ├── admin/trends/route.ts         # GET status / POST manual refresh for /admin (ADMIN_USER_IDS-gated)
│   └── admin/spotify/
│       ├── login/route.ts            # Redirects to Spotify's Authorization Code login
│       └── callback/route.ts         # Exchanges code → refresh_token, stores in spotify_auth table
lib/
├── anthropic.ts                      # Singleton Anthropic client
├── subscription.ts                   # Free/Pro/Team tier logic + admin bypass
├── supabase.ts                       # Admin client
├── trending.ts                       # trending_tracks schema + getTrendingTracksForGenre()
├── trend-sources.ts                  # genre → Spotify editorial playlist ID config (10 seeded)
├── trend-ingest.ts                   # scans playlists, resolves bpm/key, upserts trending_tracks
├── spotify-user-auth.ts              # Spotify Authorization Code flow (spotify_auth table) — see gotcha below
├── fetch-timeout.ts                  # fetchWithTimeout() — bounds outbound Spotify/ReccoBeats calls
├── secure-compare.ts                 # timingSafeEqualStr() — constant-time secret comparison
└── log-error.ts                      # logError() — console.error + Sentry.captureException/Message
```

## Supabase Schema
```sql
-- Set storage
CREATE TABLE sets (
  id uuid PK, user_id text, title text, set_data jsonb, meta jsonb,
  share_id text UNIQUE, is_public boolean DEFAULT false,
  created_at timestamptz, updated_at timestamptz
);

-- Subscription management
CREATE TABLE subscriptions (
  id uuid PK, user_id text UNIQUE, tier text DEFAULT 'free',
  status text DEFAULT 'inactive', trial_ends_at timestamptz,
  ls_subscription_id text, ls_customer_id text, updated_at timestamptz
);

-- Usage tracking (for monthly limits)
CREATE TABLE usage (
  id uuid PK, user_id text, action text, created_at timestamptz
);

-- Persistent DJ library
CREATE TABLE user_tracks (
  id uuid PK, user_id text, track_id text, title text, artist text,
  bpm numeric, key text, genre text, path text, source text,
  created_at timestamptz, updated_at timestamptz,
  UNIQUE(user_id, track_id)
);
CREATE TABLE user_crates (
  id uuid PK, user_id text, crate_id text, name text, full_path text,
  parent_id text, is_folder boolean, source text, sort_order integer,
  UNIQUE(user_id, crate_id)
);
CREATE TABLE user_crate_tracks (
  id uuid PK, user_id text, crate_id text, track_id text, sort_order integer,
  UNIQUE(user_id, crate_id, track_id)
);

-- Track history (for history-aware generation)
CREATE TABLE track_history (
  id uuid PK, user_id text, artist text, title text,
  bpm numeric, key text, genre text, set_context text, used_at timestamptz
);

-- Set analyses
CREATE TABLE set_analyses (
  id uuid PK, user_id text, track_count integer, grade text,
  scores jsonb, raw_input text, report jsonb, context text, created_at timestamptz
);

-- Community: blog posts + 2-track mix/blend uploads (supabase/community-schema.sql)
CREATE TABLE community_posts (
  id uuid PK, user_id text, author_name text, author_image text,
  type text CHECK (type in ('blog','mix')), title text, body text,
  track1_artist text, track1_title text, track1_bpm numeric, track1_key text,
  track2_artist text, track2_title text, track2_bpm numeric, track2_key text,
  audio_path text, audio_duration_sec integer, audio_size_bytes bigint,
  like_count integer DEFAULT 0, status text DEFAULT 'published',
  created_at timestamptz, updated_at timestamptz
);
CREATE TABLE community_likes (
  id uuid PK, post_id uuid REFERENCES community_posts, user_id text,
  UNIQUE(post_id, user_id), created_at timestamptz
);
```

## Pricing Model
| Tier | Price | Limits |
|------|-------|--------|
| Free | $0/forever | 5 sets/month, all features |
| Pro | $9/month | Unlimited sets |
| Team | $19/month | Pro + team access |

- 7-day Pro trial auto-created on first signup
- Trial expires → auto-downgraded to free (never fully blocked)
- `ADMIN_USER_IDS` env var gives unlimited Pro access to specified Clerk user IDs

## Subscription Flow
```
new user → trial (7 days Pro) → expires → free (5/month)
                                        → upgrade → active Pro/Team
```
Status values: `trial` | `free` | `active` | `paused` | `inactive`

## Key Technical Decisions
1. **Dynamic route `[id]` folder broken on Windows/git** — always use `/api/library/item?id=xxx` query param pattern
2. **Clerk v5/v6:** Use `await auth()` in middleware, `useAuth()` hook in components
3. **Next.js 15+ params are Promises:** `const { id } = await params`
4. **SSR safety:** Never read `localStorage` in `useState` initializer — use `useEffect`
5. **Vercel timeout:** `export const maxDuration = 120` on routes with multiple AI calls
6. **`[id]` folder avoided** — Windows git issues; use query params instead

## Generation Architecture
### Normal sets (≤13 tracks): Single Claude call
### Large sets (>13 tracks): Two-chunk approach
- Chunk 1: opening ~13 tracks with opening energy curve
- Chunk 2: closing N-13 tracks, seeded with last 2 tracks of chunk 1 for continuity
- Chunk 2 receives chunk 1 tracks in its avoid list (no cross-chunk repeats)

### Smart pre-filter (import route)
Reduces any crate (up to 500 tracks) to ≤30 candidates:
1. Deduplication
2. BPM range filter (±12 BPM)
3. Quality scoring (BPM=+10, key=+8, genre=+2)
4. Artist diversity cap (max 3 per artist)
5. BPM bucket sampling for variety

### History-aware generation
`recentTracks` array (up to 60 tracks from user's history) sent with every generate call. Prompt instructs Claude to avoid all tracks in the list. Prevents repeat songs across sessions.

### Trend-grounded generation
`GET /api/cron/refresh-trends` (daily, Vercel Cron) scans 10 seeded Spotify editorial playlists (one per major genre, `lib/trend-sources.ts`), resolves real bpm/key via ReccoBeats, and upserts into Supabase `trending_tracks` — durability-scored via `times_seen` (bumped each scan a track reappears) and decayed via `last_seen_at` (ignored after 14 days stale). Also piggybacks `track_metadata_cache` so trending tracks are pre-verified before Claude ever picks them. `generate/route.ts` fetches up to 20 trending tracks per request (`getTrendingTracksForGenre`) and injects them into the prompt as a "TRENDING NOW" block, same mechanism as the existing library-tracks injection — biases picks toward currently-popular real tracks without forcing them.

Admins can check pipeline health and force a scan without touching curl/Vercel logs at `/admin` — reads `getTrendStatus()` (per-genre counts + last-refreshed time) and can trigger `refreshTrendingTracks()` directly via a signed-in-admin-gated POST, as an alternative to the CRON_SECRET-gated cron endpoint.

**Gotcha:** Spotify blocks its own editorial playlists (`37i9dQZF1DX...`) from being read via the Client Credentials flow (no-login, app-only token) — returns 403 for apps without Extended Quota Mode approval. `lib/track-match.ts`'s `getSpotifyToken()` (Client Credentials) still works fine for track search/verification, but playlist reads for trend ingestion need a *real logged-in* Spotify user token instead. `lib/spotify-user-auth.ts` implements the Authorization Code flow for this — admin visits `/admin`, clicks "Connect Spotify" once, and the resulting refresh token is stored in the `spotify_auth` table (schema in that file's header comment) and auto-refreshed thereafter. `trend-ingest.ts` uses `getUserAccessToken()`, not `getSpotifyToken()`. Requires `SPOTIFY_REDIRECT_URI` registered exactly in the Spotify Developer Dashboard.

## App Features (all live)
**Core:**
- Genre selector (42 genres in 7 groups) + custom genre text input
- Crowd, energy arc selectors
- Vibe/mood + reference artists (optional)
- Interactive energy curve (EnergyEditor SVG, 5 draggable points, Catmull-Rom spline)
- Set length slider (time or count)
- BPM low/high + harmonic key matching toggle
- Mix notes toggle (ON = transition notes, OFF = faster tracklist-only generation)

**Results:**
- Camelot wheel visualization (SVG, hover to inspect keys)
- Energy bar
- Key sequence sidebar
- Track list with: drag-to-reorder, lock/unlock, hot-swap, Beatport/Spotify/YouTube/SoundCloud links
- "Seen before" badge on repeated tracks
- "Why this track?" expandable explanation per track

**Track Actions:**
- Save to library, copy tracklist (with SetForge watermark), export .txt, share public link
- Lock tracks → Reforge around them
- Drag to reorder (HTML5 native, handle-only drag)

**Library (left panel tabs):**
- ⚡ FORGE — set creation form
- ◈ LIBRARY — saved SetForge sets (compact cards, load/share/delete/rename)
- ↑ IMPORT — UserLibrary component (persistent DJ library)

**Persistent DJ Library (UserLibrary component):**
- Supports Rekordbox XML, Traktor NML, Serato binary (.crate files + database V2)
- Upload once → stored in Supabase permanently
- Crate browser tree with expand/collapse
- "Build Set From Crate" → runs through smart prefilter → chunked generation

**Analyser (/analyse):**
- Paste any tracklist format → AI grades the set
- Scores: Energy Flow, Harmonic Mixing, BPM Progression, Track Selection, Set Structure
- Peak moment, weakest transition + fix, strengths, improvements, track notes, verdict
- Energy journey SVG chart
- Export as full report or tracklist-only txt
- "From my library" — analyse any saved SetForge set directly
- Results saved to `set_analyses` table for history tracking

**Onboarding:**
- 5-step wizard for first-time users (genre, energy, crowd, length, reference artist)
- `localStorage` key `sf_onboarded` to skip on return visits
- First-set celebration banner

**Sharing:**
- Public set page at `/s?id=xxx`
- Share page shows full set + "Forge Your Own" CTA
- Share links created/managed via `/api/share`

## Landing Page
- Animated gradient blobs (CSS keyframes, no JS)
- Scrolling ticker bar (12 feature blurbs)
- Scroll-reveal sections (IntersectionObserver)
- Count-up stats
- Example sets gallery (3 pre-built: Tech House, Afro House, Peak Techno)
- FAQ accordion (beginner-friendly, no jargon)
- Free/Pro/Team pricing with real Lemon Squeezy checkout buttons
- Signed-in users get "Open App" / real upgrade buttons
- Signed-out users get Clerk SignUpButton modal

## Payments (Lemon Squeezy)
- `/api/checkout` → creates LS hosted checkout URL with Clerk userId as custom_data
- `/api/webhooks/lemon-squeezy` → handles subscription_created/updated/cancelled/expired
- Webhook verified with HMAC-SHA256 signature
- On payment: Supabase `subscriptions` row upserted with `status: active`, `tier: pro/team`
- Receipt thank-you note included in checkout creation

## Common Bugs / Gotchas
- `app/api/library/[id]/` folder name causes Windows git issues — always use query params
- Vercel env vars must have ALL THREE environments checked (Production + Preview + Development)
- Clerk production requires `pk_live_` key (not `pk_test_`)
- After any env var change in Vercel, must redeploy
- `localStorage` must be read in `useEffect`, never in `useState` initializer (SSR)
- `trackHistory` state required for `recentTracks` in generate fetch — must be loaded via `useEffect` from `/api/track-history`
- Dynamic route brackets `[id]` cause Windows git issues — use `item?id=` query param pattern throughout

## Founder
Garrett Bess — solo founder, building SetForge as both a product and content for YouTube channel. Beach volleyball DJ (real use case — tested personally).
