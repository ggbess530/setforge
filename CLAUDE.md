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
├── community/
│   └── page.tsx                      # Community feed — blog posts + 2-track mix uploads (/community)
├── team/
│   └── page.tsx                      # Team seat management — invite/accept/leave/remove (/team)
├── u/
│   └── page.tsx                      # Public profile (/u?handle=xxx, or /u?me=1 for your own) — query param, not [handle] folder
├── admin/
│   └── page.tsx                      # Admin-only trending-tracks dashboard (status + manual refresh)
├── sign-in/[[...sign-in]]/page.tsx
├── sign-up/[[...sign-up]]/page.tsx
├── components/
│   ├── EnergyEditor.tsx              # Interactive SVG energy curve (5 draggable points)
│   ├── OnboardingWizard.tsx          # First-time user 5-step wizard
│   ├── UserLibrary.tsx               # Persistent library with crate browser
│   ├── LibraryImporter.tsx           # One-time import (older, superseded by UserLibrary)
│   └── NotificationBell.tsx          # Bell dropdown, dropped into each page's own nav (no shared layout in this app)
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
│   │   ├── item/route.ts             # GET/PATCH/DELETE single set (query params, no [id] folder) — GET also allows a teammate loading a team-shared set
│   │   └── feedback/
│   │       ├── route.ts              # GET a saved set's crowd ratings / POST upsert one track's hit-or-miss
│   │       └── item/route.ts         # DELETE clear a track's rating (query params, no [id] folder)
│   ├── user-library/route.ts         # Persistent DJ library (tracks + crates)
│   ├── track-history/route.ts        # Track usage history
│   ├── why/route.ts                  # "Why this track" explanations
│   ├── share/route.ts                # Public set sharing
│   ├── checkout/route.ts             # Lemon Squeezy checkout URL creation
│   ├── webhooks/lemon-squeezy/route.ts  # Subscription webhook handler
│   ├── cron/refresh-trends/route.ts  # Daily Vercel Cron — refreshes trending_tracks (CRON_SECRET-gated)
│   ├── admin/trends/route.ts         # GET status / POST manual refresh for /admin (ADMIN_USER_IDS-gated)
│   ├── admin/spotify/
│   │   ├── login/route.ts            # Redirects to Spotify's Authorization Code login
│   │   └── callback/route.ts         # Exchanges code → refresh_token, stores in spotify_auth table
│   ├── community/
│   │   ├── posts/route.ts            # GET paginated feed (compound created_at+id cursor) / POST blog post
│   │   ├── posts/item/route.ts       # DELETE own post (query param, no [id] folder)
│   │   ├── likes/route.ts            # POST toggle like (query param postId)
│   │   ├── mixes/route.ts            # POST finalize a mix post after audio upload
│   │   ├── mixes/upload-url/route.ts # POST signed Supabase Storage upload URL (quota + file checks)
│   │   ├── mixes/quota/route.ts      # GET remaining mix-upload quota for composer UI
│   │   ├── comments/route.ts         # GET nested comments for a post / POST comment or reply (flattened to 1 level)
│   │   └── comments/item/route.ts    # DELETE own comment (query param, no [id] folder) — cascades to its replies
│   ├── team/
│   │   ├── route.ts                  # GET full team status (role, roster, seats, pending invite)
│   │   ├── sets/route.ts             # GET sets any teammate shared to the team
│   │   ├── invite/route.ts           # POST invite teammate by email (lazily creates the team row)
│   │   ├── invite/item/route.ts      # DELETE revoke pending invite (query param, owner-only)
│   │   ├── claim/route.ts            # POST accept/decline a pending invite matching my Clerk email
│   │   └── member/route.ts           # DELETE remove teammate (owner) or leave (self)
│   ├── notifications/
│   │   ├── route.ts                  # GET recent notifications + unread count (polled by NotificationBell.tsx)
│   │   └── read/route.ts             # POST mark all as read (fires when the bell dropdown opens)
│   ├── profile/
│   │   ├── route.ts                  # GET ?handle=xxx — public profile (Clerk identity, Community posts, public sets, follow counts)
│   │   └── me/route.ts               # GET the caller's own handle, auto-provisioning one
│   └── follow/route.ts               # POST { userId } — toggle follow/unfollow, notifies on new follow
lib/
├── anthropic.ts                      # Singleton Anthropic client
├── subscription.ts                   # Free/Pro/Team tier logic + admin bypass + team-seat pass-through
├── team.ts                           # Team seat resolution — getRiddenTeam()/getOwnedTeam()/getMyTeamId(), SEAT_LIMIT
├── notifications.ts                  # notify() — fire-and-forget writer called from likes/comments/team routes
├── track-feedback.ts                  # getFeedbackSignal() — aggregates set_feedback into a genre-scoped proven/avoid list for generate/route.ts
├── profile.ts                         # getOrCreateHandle()/getExistingHandle()/getUserIdForHandle() — public profile handles
├── supabase.ts                       # Admin client
├── trending.ts                       # trending_tracks schema + getTrendingTracksForGenre()
├── trend-sources.ts                  # genre → Spotify editorial playlist ID config (10 seeded)
├── trend-ingest.ts                   # scans playlists, resolves bpm/key, upserts trending_tracks
├── spotify-user-auth.ts              # Admin's own singleton Spotify login (spotify_auth table, no scopes) — see gotcha below
├── track-match.ts                     # findSpotifyTrack() fuzzy-match cascade + Camelot mapping, used by the metadata enrichment pipeline
├── mix-utils.ts                      # Camelot/BPM compatibility scoring shared by inline sim, /mix, and Community mix cards
├── pdf-export.ts                      # generateSetPdf()/viewPdfInNewTab() — client-side PDF via jsPDF, no server round-trip
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
-- community_posts.comment_count (additive) + community_comments (supabase/community-comments-schema.sql)
CREATE TABLE community_comments (
  id uuid PK, post_id uuid REFERENCES community_posts, parent_id uuid REFERENCES community_comments,
  user_id text, author_name text, author_image text, body text,
  status text DEFAULT 'published', created_at timestamptz
);
-- parent_id null = top-level; set = reply, always re-parented to the top-level
-- comment by the API (flattened to 1 level deep — never a reply-to-a-reply row)

-- In-app notifications (supabase/notifications-schema.sql). message/link are
-- precomputed server-side at insert time — frontend never joins back to
-- posts/comments/teams to render one.
CREATE TABLE notifications (
  id uuid PK, user_id text, type text CHECK (type in ('like','comment','reply','team_invite','team_accepted')),
  actor_name text, actor_image text, message text, link text,
  read boolean DEFAULT false, created_at timestamptz
);

-- Crowd feedback (supabase/set-feedback-schema.sql) — tied to a SAVED set +
-- track position, not track_history (a loose per-generation log with no
-- stable id to update later). artist/title denormalized so lib/track-feedback.ts
-- can aggregate across every set the DJ has ever played, not just this one.
CREATE TABLE set_feedback (
  id uuid PK, set_id uuid REFERENCES sets, user_id text, track_n integer,
  artist text, title text, genre text, rating text CHECK (rating in ('hit','miss')),
  created_at timestamptz, updated_at timestamptz, UNIQUE(set_id, track_n)
);

-- Team seats: one paying "owner" (their own row in `subscriptions`, tier='team')
-- invites up to SEAT_LIMIT-1 teammates who ride that subscription (supabase/team-schema.sql)
CREATE TABLE teams (
  id uuid PK, owner_id text UNIQUE, name text DEFAULT 'My Team',
  seat_limit integer DEFAULT 5, created_at timestamptz, updated_at timestamptz
);
CREATE TABLE team_members (   -- invited members ONLY — owner is teams.owner_id, never a row here
  id uuid PK, team_id uuid REFERENCES teams, user_id text UNIQUE, joined_at timestamptz
);
CREATE TABLE team_invites (
  id uuid PK, team_id uuid REFERENCES teams, email text, invited_by text,
  status text DEFAULT 'pending' CHECK (status in ('pending','accepted','revoked')),
  created_at timestamptz, expires_at timestamptz, UNIQUE(team_id, email)
);
-- sets.shared_to_team_id (nullable, additive) — a set shared to a team is
-- visible to every member of that team; ALTER TABLE in supabase/team-schema.sql

-- Public profiles + follow graph (supabase/profiles-schema.sql). Handles are
-- auto-provisioned (lib/profile.ts) the first time a user posts to Community
-- or visits their own profile — never a signup-time step.
CREATE TABLE profile_handles (
  user_id text PK, handle text UNIQUE, created_at timestamptz, updated_at timestamptz
);
CREATE TABLE follows (
  id uuid PK, follower_id text, followee_id text,
  UNIQUE(follower_id, followee_id), created_at timestamptz
);
-- community_posts.author_handle (additive) — same denormalized-snapshot
-- pattern as author_name/author_image, set at post-creation time
-- notifications.type CHECK widened to add 'follow'
```

## Pricing Model
| Tier | Price | Limits |
|------|-------|--------|
| Free | $0/forever | 5 sets/month, all features |
| Pro | $9/month | Unlimited sets |
| Team | $19/month | Pro + up to 5 seats + shared team sets |

- 7-day Pro trial auto-created on first signup
- Trial expires → auto-downgraded to free (never fully blocked)
- `ADMIN_USER_IDS` env var gives unlimited Pro access to specified Clerk user IDs
- Team tier: the paying user ("owner") invites up to 4 teammates from `/team`; invited members ride the owner's subscription (`checkSubscription()` resolves this via `lib/team.ts`'s `getRiddenTeam()`) — no separate billing, no personal trial row created for them. If the owner's subscription lapses, members silently fall back to their own free/trial status next time `checkSubscription()` runs — never fully blocked, same philosophy as the free tier.

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

### Crowd-feedback-aware generation
After a gig, the DJ rates individual tracks in a *saved* set as hit/miss (👍/👎 button per track, only active once a set has a stable id — i.e. saved, not just generated) from `/app`. `generate/route.ts` calls `getFeedbackSignal(userId, genre)` (`lib/track-feedback.ts`) alongside the existing trending-tracks fetch, aggregates `set_feedback` by artist+title within that genre, and injects two prompt blocks the same way `trendingBlock`/`libraryBlock` already work: a "PROVEN CROWD-PLEASERS" list (net hits > misses) Claude is told to prefer, and an "AVOID" list (net misses > hits) it's told to skip. This is the one signal genuinely specific to each DJ's own real gig history rather than generic popularity data.

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
- Export as Rekordbox XML / Serato M3U / Traktor NML (`lib/export-utils.ts`)
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
- Share links created/managed via `/api/share` (`POST` makes public + generates a `share_id`, `DELETE ?setId=` makes private again — clears `share_id`, so the old link 404s immediately rather than just being unlisted)
- Visibility toggle lives inside the set's edit mode in the Library tab (click ✎ next to the title — same place renaming happens), not a standalone button: shows "🌐 PUBLIC · copy link" + a confirm-gated "Make private" when public, or "🔒 PRIVATE · make public" when not. A small 🌐 badge next to the title (outside edit mode) shows current visibility at a glance.
- `/s?id=xxx` has a "VIEW AS PDF" button — `lib/pdf-export.ts`'s `generateSetPdf()` builds a print-friendly (light theme, not the app's dark UI) PDF client-side via jsPDF and opens it in a new tab; no server round-trip, same philosophy as the Rekordbox/Serato/Traktor exporters. Public sets linked from a DJ's profile (`/u`) route through this same `/s` page rather than duplicating the PDF button there.

**Community (/community):**
- Feed of blog posts (tips/questions) and 2-track "mix" uploads (audio blend + Camelot/BPM compatibility badge via `lib/mix-utils.ts`)
- Tabs: All / Posts / Mixes; cursor-paginated (compound `created_at`+`id` cursor — ties on `created_at` alone silently drop rows, so both are required)
- Mix uploads go straight to the `community-audio` Storage bucket via a signed upload URL (keeps large audio off the Vercel request path); tiered quota via `checkMixUploadQuota()` in `lib/subscription.ts` (free: 3 lifetime / pro,team: 20 per month)
- Like/unlike via `increment_like_count` Postgres function (atomic, avoids a read-then-write race)
- Delete own post (cascades to likes + removes the audio object from Storage)
- Comments + one level of replies per post, lazy-loaded on expand (not fetched with the feed); a reply to a reply gets re-parented to the original top-level comment rather than nesting further; `increment_comment_count` mirrors the like-count function's atomic-bump pattern

**Team (/team):**
- Team-tier subscriber ("owner") invites up to 4 teammates by email from `/team`; no email is actually sent (no email provider in this stack) — the teammate signs in with that exact email and accepts from `/team` themselves
- Invited members get unlimited generations riding the owner's subscription — see Pricing Model above and `lib/team.ts`
- Owner can revoke a pending invite or remove a member; a member can leave on their own
- `sets.shared_to_team_id` (nullable) lets a saved set be shared with the whole team — wired into the Library tab in `/app` (share toggle on save + per-card, "TEAM SETS" sub-tab via `getMyTeamId()`/`GET /api/team/sets`)

**Notifications (bell icon, all authenticated nav bars):**
- `lib/notifications.ts`'s `notify()` is a fire-and-forget write, called from the routes that trigger each event — never blocks or fails the caller's main action if it errors
- Triggers: someone likes/comments on your post, someone replies to your comment (notifies whoever they're actually replying to, not necessarily the post owner), a team invite lands for an email that already has a SetForge account, someone accepts your team invite
- `NotificationBell.tsx` polls `GET /api/notifications` every 45s for the badge count; opening the dropdown fires `POST /api/notifications/read` (marks all read — no per-notification granularity)
- No shared layout/header in this app — the bell is manually dropped into each page's own inline nav (`/`, `/app`, `/community`, `/team`)

**Public profiles + follow (/u):**
- `/u?handle=xxx` — Clerk name/avatar, follower/following counts, their Community posts + public sets (`sets.is_public`, the same flag `/api/share` flips); `/u?me=1` resolves to the caller's own handle via `GET /api/profile/me` and swaps the URL to the canonical `?handle=` form
- Handles are auto-provisioned at post-creation time (not signup) via `lib/profile.ts`'s `getOrCreateHandle()` — no customization UI yet, just a slugified Clerk username/name with a numeric suffix on collision
- Follow/unfollow via `POST /api/follow`; notifies the followee (type `'follow'`)
- Community's tab bar has a "Following only" toggle (`scope=following` on `GET /api/community/posts`) alongside the existing All/Posts/Mixes type filter — independent axes, combinable
- Community post authors link to `/u?handle=...` when `author_handle` is present (older posts created before this feature don't have one and just render as plain text)

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
