// ▸ Create folder: app/u/
// ▸ Place at:      app/u/page.tsx
// Public profile — /u?handle=xxx (query param, not a [handle] folder — see
// the Windows/git gotcha in CLAUDE.md, same reason /s?id= isn't /s/[id]).
// /u?me=1 resolves to the caller's own handle (auto-provisioning one) and
// swaps the URL to the canonical ?handle= form via history.replaceState.

'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth, UserButton } from '@clerk/nextjs'
import { calcBridge } from '@/lib/mix-utils'
import NotificationBell from '../components/NotificationBell'

const C = '#00f0ff'
const M = '#ff1e8a'

type ProfilePost = {
  id: string; type: 'blog' | 'mix'; title: string; body: string | null
  track1_artist: string | null; track1_title: string | null; track1_bpm: number | null; track1_key: string | null
  track2_artist: string | null; track2_title: string | null; track2_bpm: number | null; track2_key: string | null
  audioUrl: string | null; audio_duration_sec: number | null
  like_count: number; comment_count: number; created_at: string
}
type PublicSet = { id: string; title: string; meta: Record<string, string | number>; created_at: string; share_id: string | null }
type ProfileData = {
  userId: string; handle: string; name: string; imageUrl: string | null
  isMe: boolean; isFollowing: boolean; followerCount: number; followingCount: number
  posts: ProfilePost[]; publicSets: PublicSet[]
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}
function fmtDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60), s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function CompatBadge({ p }: { p: ProfilePost }) {
  if (!p.track1_bpm || !p.track2_bpm || !p.track1_key || !p.track2_key) return null
  const bridge = calcBridge(
    { artist: p.track1_artist ?? '', title: p.track1_title ?? '', bpm: p.track1_bpm, key: p.track1_key },
    { artist: p.track2_artist ?? '', title: p.track2_title ?? '', bpm: p.track2_bpm, key: p.track2_key },
  )
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: bridge.color, border: `1px solid ${bridge.color}55`, borderRadius: 999, padding: '3px 9px', fontFamily: 'JetBrains Mono,monospace', letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {bridge.compatibility.toUpperCase()} · {bridge.score}/100
    </span>
  )
}

function ProfilePageInner() {
  const { isSignedIn } = useAuth()
  const params = useSearchParams()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<'posts' | 'sets'>('posts')
  const [followBusy, setFollowBusy] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const load = useCallback(() => {
    // The whole body runs inside this .then() callback (a separate function
    // value, not load's own synchronous body) — load() itself schedules work
    // but never calls a setter directly, which is what the effect below needs.
    Promise.resolve().then(async () => {
      try {
        let handle = params.get('handle')
        if (!handle && params.get('me')) {
          const meRes = await fetch('/api/profile/me')
          const meData = await meRes.json()
          if (!meRes.ok) { setNotFound(true); return }
          handle = meData.handle
          router.replace(`/u?handle=${handle}`)
        }
        if (!handle) { setNotFound(true); return }

        const res = await fetch(`/api/profile?handle=${handle}`)
        const data = await res.json()
        if (!res.ok) { setNotFound(true); return }
        setProfile(data); setNotFound(false)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    })
  }, [params, router])

  useEffect(() => { load() }, [load])

  async function toggleFollow() {
    if (!profile || !isSignedIn) return
    setFollowBusy(true)
    const wasFollowing = profile.isFollowing
    setProfile(p => p && { ...p, isFollowing: !wasFollowing, followerCount: p.followerCount + (wasFollowing ? -1 : 1) })
    try {
      const res = await fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: profile.userId }) })
      if (!res.ok) throw new Error()
    } catch {
      setProfile(p => p && { ...p, isFollowing: wasFollowing, followerCount: p.followerCount + (wasFollowing ? 1 : -1) })
    } finally { setFollowBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: '#e8e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .up-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:box-shadow .2s,transform .15s; }
        .up-btn-primary:hover:enabled { box-shadow:0 0 0 3px ${C}44; transform:translateY(-1px); }
        .up-btn-primary:disabled { opacity:.5; cursor:default; }
        .up-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; }
        .up-btn-ghost:hover:enabled { border-color:${C}; color:${C}; }
        .up-card:hover { border-color:#23233a!important; }
        * { box-sizing:border-box; }
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(16px)', background: 'rgba(6,6,12,.88)', padding: isMobile ? '0 10px' : '0 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: isMobile ? 20 : 24, letterSpacing: 2 }}>
              <span style={{ color: C }}>SET</span><span style={{ color: M }}>FORGE</span>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: isMobile ? 6 : 10, alignItems: 'center' }}>
            <Link href="/community" style={{ textDecoration: 'none' }}><button className="up-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12 }}>👥{!isMobile && ' Community'}</button></Link>
            {isSignedIn && <NotificationBell />}
            {isSignedIn ? <UserButton /> : <Link href="/sign-in"><button className="up-btn-primary" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12 }}>Sign in</button></Link>}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '24px 14px 60px' : '40px 24px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4a4a66', fontSize: 13 }}>Loading profile…</div>
        ) : notFound || !profile ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a4a66', fontSize: 13, border: '1px dashed #1a1a2e', borderRadius: 16 }}>
            Profile not found.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              {profile.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.imageUrl} alt="" width={64} height={64} style={{ borderRadius: '50%', flexShrink: 0 }} />
                : <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg,${M},${C})`, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, margin: 0, letterSpacing: 1 }}>{profile.name}</h1>
                <div style={{ fontSize: 12, color: '#6a6a8a', fontFamily: 'JetBrains Mono,monospace' }}>@{profile.handle}</div>
                <div style={{ fontSize: 12, color: '#8a8aa8', marginTop: 4, display: 'flex', gap: 14 }}>
                  <span><strong style={{ color: '#e8e8f0' }}>{profile.followerCount}</strong> followers</span>
                  <span><strong style={{ color: '#e8e8f0' }}>{profile.followingCount}</strong> following</span>
                </div>
              </div>
              {!profile.isMe && (
                <button onClick={toggleFollow} disabled={followBusy || !isSignedIn} className={profile.isFollowing ? 'up-btn-ghost' : 'up-btn-primary'} style={{ padding: '9px 20px', borderRadius: 9, fontSize: 12 }}>
                  {profile.isFollowing ? 'FOLLOWING' : '+ FOLLOW'}
                </button>
              )}
            </div>

            <div style={{ display: 'inline-flex', border: '1px solid #1f1f33', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
              {(['posts', 'sets'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace', background: tab === t ? `linear-gradient(100deg,${M},${C})` : 'transparent', color: tab === t ? '#06060c' : '#8a8aa8' }}>
                  {t === 'posts' ? `Community (${profile.posts.length})` : `Public Sets (${profile.publicSets.length})`}
                </button>
              ))}
            </div>

            {tab === 'posts' ? (
              profile.posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4a4a66', fontSize: 13, border: '1px dashed #1a1a2e', borderRadius: 16 }}>No Community posts yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {profile.posts.map(p => (
                    <div key={p.id} className="up-card" style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 16, padding: 18 }}>
                      <div style={{ fontSize: 10, color: '#4a4a66', marginBottom: 6 }}>{timeAgo(p.created_at)} · {p.type === 'mix' ? '🎧 mix' : '✎ post'}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: p.type === 'mix' ? 8 : 4 }}>{p.title}</div>
                      {p.type === 'mix' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#9a9ab8', background: '#06060c', border: '1px solid #1a1a2e', borderRadius: 8, padding: '4px 9px' }}>{p.track1_artist} — {p.track1_title}</span>
                            <span style={{ color: '#4a4a66' }}>→</span>
                            <span style={{ fontSize: 11, color: '#9a9ab8', background: '#06060c', border: '1px solid #1a1a2e', borderRadius: 8, padding: '4px 9px' }}>{p.track2_artist} — {p.track2_title}</span>
                            <CompatBadge p={p} />
                          </div>
                          {p.audioUrl && <audio controls src={p.audioUrl} style={{ width: '100%', height: 32 }} />}
                          {p.audio_duration_sec ? <div style={{ fontSize: 10, color: '#4a4a66' }}>{fmtDuration(p.audio_duration_sec)}</div> : null}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#c8c8e0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.body}</div>
                      )}
                      <div style={{ marginTop: 10, fontSize: 11, color: '#5a5a78', display: 'flex', gap: 12 }}>
                        <span>♡ {p.like_count}</span>
                        <span>💬 {p.comment_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              profile.publicSets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4a4a66', fontSize: 13, border: '1px dashed #1a1a2e', borderRadius: 16 }}>No public sets yet — sets shared via the SHARE button in the app show up here.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {profile.publicSets.map(s => (
                    <Link key={s.id} href={`/s?id=${s.share_id}`} className="up-card" style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: .5, color: C, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {[s.meta?.genre, s.meta?.crowd].map(tag => tag && (
                            <span key={String(tag)} style={{ fontSize: 9, color: '#6a6a8a', border: '1px solid #1f1f33', borderRadius: 999, padding: '1px 7px' }}>{String(tag)}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#06060c' }} />}>
      <ProfilePageInner />
    </Suspense>
  )
}
