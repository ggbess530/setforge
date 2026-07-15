// ▸ Create folder: app/stats/
// ▸ Place at:      app/stats/page.tsx
// Personal stats dashboard — auth-gated, own data only (unlike /u which is
// public). Colors: hit/miss uses the dataviz skill's validated status pair
// (good #0ca30c / critical #d03b3b, checked against this app's #0a0a14 card
// surface — see conversation), never the brand cyan/magenta, since it's a
// genuine state (good/bad outcome) not a decorative series. Genre + activity
// charts are single-series magnitude, so brand cyan is correct there (identity
// is carried by the direct label, not color).

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth, UserButton } from '@clerk/nextjs'
import NotificationBell from '../components/NotificationBell'

const C = '#00f0ff'
const M = '#ff1e8a'
const GOOD = '#0ca30c'
const CRITICAL = '#d03b3b'

type Stats = {
  memberSince: string | null
  tier: string
  totalSets: number
  totalGenerations: number
  followerCount: number
  postsPublished: number
  totalLikesReceived: number
  totalCommentsReceived: number
  genreBreakdown: { genre: string; count: number }[]
  activityByMonth: { month: string; count: number }[]
  feedback: {
    hits: number; misses: number; hitRate: number | null
    byMonth: { month: string; hits: number; misses: number }[]
    topProven: { artist: string; title: string; hits: number; misses: number }[]
    topAvoid: { artist: string; title: string; hits: number; misses: number }[]
  }
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 12, padding: '14px 16px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#e8e8f0' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8a8aa8', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function TrackRow({ t, tone }: { t: { artist: string; title: string; hits: number; misses: number }; tone: 'good' | 'critical' }) {
  const color = tone === 'good' ? GOOD : CRITICAL
  const count = tone === 'good' ? t.hits : t.misses
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #14142a' }}>
      <div style={{ fontSize: 12, color: '#c8c8e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist} — {t.title}</div>
      <div style={{ fontSize: 11, color, fontWeight: 700, flexShrink: 0, fontFamily: 'JetBrains Mono,monospace' }}>{tone === 'good' ? '👍' : '👎'} {count}</div>
    </div>
  )
}

export default function StatsPage() {
  const { isSignedIn } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/stats').then(r => r.json()).then(d => { if (!d.error) setStats(d) }).finally(() => setLoading(false))
  }, [isSignedIn])

  const maxActivity = stats ? Math.max(1, ...stats.activityByMonth.map(m => m.count)) : 1
  const maxGenre = stats ? Math.max(1, ...stats.genreBreakdown.map(g => g.count)) : 1
  const maxFeedbackMonth = stats ? Math.max(1, ...stats.feedback.byMonth.flatMap(m => [m.hits, m.misses])) : 1

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: '#e8e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .stats-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; text-decoration:none; }
        .stats-btn-ghost:hover { border-color:${C}; color:${C}; }
        .stats-card { background:#0a0a14; border:1px solid #1a1a2e; border-radius:14px; padding:18px; }
        * { box-sizing:border-box; }
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(16px)', background: 'rgba(6,6,12,.88)', padding: isMobile ? '0 10px' : '0 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: isMobile ? 20 : 24, letterSpacing: 2 }}>
              <span style={{ color: C }}>SET</span><span style={{ color: M }}>FORGE</span>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: isMobile ? 6 : 10, alignItems: 'center' }}>
            <Link href="/app" className="stats-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12 }}>⚡{!isMobile && ' Forge'}</Link>
            {isSignedIn && <NotificationBell />}
            {isSignedIn ? <UserButton /> : <Link href="/sign-in"><button className="stats-btn-ghost" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12 }}>Sign in</button></Link>}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: isMobile ? '24px 14px 60px' : '40px 24px 80px' }}>
        {!isSignedIn ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a4a66', fontSize: 13, border: '1px dashed #1a1a2e', borderRadius: 16 }}>
            <Link href="/sign-in" style={{ color: C }}>Sign in</Link> to see your stats.
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4a4a66', fontSize: 13 }}>Loading your stats…</div>
        ) : !stats ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a4a66', fontSize: 13 }}>Failed to load stats.</div>
        ) : (
          <>
            {/* Hero figure — exactly one per view */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: M, fontFamily: 'JetBrains Mono,monospace', letterSpacing: 3, marginBottom: 10 }}>YOUR STATS</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(48px,10vw,84px)', lineHeight: 1, color: C }}>{stats.totalGenerations}</div>
              <div style={{ fontSize: 13, color: '#8a8aa8', marginTop: 4 }}>
                sets forged{stats.memberSince ? ` since ${new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''} · {stats.tier} plan
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <StatTile label="Sets saved" value={stats.totalSets} />
              <StatTile label="Followers" value={stats.followerCount} />
              <StatTile label="Community posts" value={stats.postsPublished} />
              <StatTile label="Likes received" value={stats.totalLikesReceived} />
            </div>

            {/* Hit rate meter */}
            <div className="stats-card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0', marginBottom: 12 }}>Crowd hit rate</div>
              {stats.feedback.hitRate === null ? (
                <div style={{ fontSize: 12, color: '#4a4a66' }}>No ratings yet — after a gig, rate tracks 👍/👎 on a saved set to start building this.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 28, fontWeight: 600, color: GOOD }}>{stats.feedback.hitRate}%</div>
                    <div style={{ fontSize: 11, color: '#8a8aa8' }}>{stats.feedback.hits} hits · {stats.feedback.misses} misses</div>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: '#1a1a2e', overflow: 'hidden' }} title={`${stats.feedback.hitRate}% hit rate`}>
                    <div style={{ height: '100%', width: `${stats.feedback.hitRate}%`, background: GOOD, borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                </>
              )}
            </div>

            {/* Hit/miss trend */}
            {(stats.feedback.hits + stats.feedback.misses) > 0 && (
              <div className="stats-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Hit / miss by month</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#8a8aa8' }}>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: GOOD, marginRight: 5 }} />Hit</span>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: CRITICAL, marginRight: 5 }} />Miss</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 90 }}>
                  {stats.feedback.byMonth.map(m => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70, width: '100%', justifyContent: 'center' }}>
                        <div title={`${m.month}: ${m.hits} hits`} style={{ width: 14, height: `${(m.hits / maxFeedbackMonth) * 100}%`, minHeight: m.hits ? 3 : 0, background: GOOD, borderRadius: '4px 4px 0 0' }} />
                        <div title={`${m.month}: ${m.misses} misses`} style={{ width: 14, height: `${(m.misses / maxFeedbackMonth) * 100}%`, minHeight: m.misses ? 3 : 0, background: CRITICAL, borderRadius: '4px 4px 0 0' }} />
                      </div>
                      <div style={{ fontSize: 9, color: '#5a5a78' }}>{m.month}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proven / avoid lists */}
            {(stats.feedback.topProven.length > 0 || stats.feedback.topAvoid.length > 0) && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
                {stats.feedback.topProven.length > 0 && (
                  <div className="stats-card" style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>🔥 Proven tracks</div>
                    {stats.feedback.topProven.map(t => <TrackRow key={`${t.artist}-${t.title}`} t={t} tone="good" />)}
                  </div>
                )}
                {stats.feedback.topAvoid.length > 0 && (
                  <div className="stats-card" style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>⚠ Tracks to avoid</div>
                    {stats.feedback.topAvoid.map(t => <TrackRow key={`${t.artist}-${t.title}`} t={t} tone="critical" />)}
                  </div>
                )}
              </div>
            )}

            {/* Genre breakdown */}
            {stats.genreBreakdown.length > 0 && (
              <div className="stats-card" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 14 }}>Genres you forge most</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.genreBreakdown.map(g => (
                    <div key={g.genre} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 11, color: '#c8c8e0', width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.genre}</div>
                      <div style={{ flex: 1, height: 14, background: '#14142a', borderRadius: 4 }}>
                        <div title={`${g.genre}: ${g.count}`} style={{ height: '100%', width: `${(g.count / maxGenre) * 100}%`, minWidth: 4, background: C, borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#8a8aa8', width: 20, textAlign: 'right', flexShrink: 0 }}>{g.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity by month */}
            <div className="stats-card">
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 14 }}>Activity — last 12 months</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 4 : 8, height: 90 }}>
                {stats.activityByMonth.map(m => (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div title={`${m.month}: ${m.count}`} style={{ width: '100%', maxWidth: 24, height: `${(m.count / maxActivity) * 70}px`, minHeight: m.count ? 3 : 0, background: C, borderRadius: '4px 4px 0 0' }} />
                    <div style={{ fontSize: 9, color: '#5a5a78' }}>{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
