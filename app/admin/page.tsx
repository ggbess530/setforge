// ▸ Create folder: app/admin/
// ▸ Place at:      app/admin/page.tsx

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useAuth } from '@clerk/nextjs'

const C = '#00f0ff'
const M = '#ff1e8a'

type TrendStatus = {
  totalTracks:      number
  lastRefreshed:    string | null
  byGenre:          { genre: string; trackCount: number }[]
  spotifyConnected: boolean
}

const SPOTIFY_BANNER: Record<string, { text: string; ok: boolean }> = {
  connected:     { text: 'Spotify connected successfully.',                          ok: true },
  denied:        { text: 'Spotify authorization was denied.',                        ok: false },
  invalid_state: { text: 'Login session expired or was invalid — please try again.', ok: false },
  error:         { text: 'Spotify connection failed — check server logs.',           ok: false },
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const hrs = Math.floor(ms / (1000 * 60 * 60))
  if (hrs < 1) return 'less than an hour ago'
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const [status,      setStatus]      = useState<TrendStatus | null>(null)
  const [forbidden,   setForbidden]   = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [refreshMsg,  setRefreshMsg]  = useState<string | null>(null)
  const [refreshErrors, setRefreshErrors] = useState<{ genre: string; playlistId: string; error: string }[]>([])
  const [spotifyParam, setSpotifyParam]   = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('spotify')
    if (!p) return
    window.history.replaceState({}, '', '/admin')
    Promise.resolve().then(() => setSpotifyParam(p))
  }, [])

  async function loadStatus() {
    try {
      const res = await fetch('/api/admin/trends')
      if (res.status === 403) { setForbidden(true); return }
      setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isLoaded && isSignedIn) loadStatus() }, [isLoaded, isSignedIn])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshMsg(null)
    setRefreshErrors([])
    try {
      const res = await fetch('/api/admin/trends', { method: 'POST' })
      const data = await res.json()
      setRefreshMsg(res.ok
        ? `Scanned ${data.genresScanned} genres, upserted ${data.tracksUpserted} tracks.`
        : `Failed: ${data.error || 'unknown error'}`)
      setRefreshErrors(data.errors ?? [])
      await loadStatus()
    } catch {
      setRefreshMsg('Failed: request error')
    } finally {
      setRefreshing(false)
    }
  }

  const cardStyle = { background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:'20px 24px' }

  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap');
        .btn-cta  { background:linear-gradient(110deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:box-shadow .2s,transform .15s; }
        .btn-cta:hover  { box-shadow:0 0 0 3px ${C}44,0 8px 40px ${C}44,0 8px 40px ${M}28; transform:translateY(-1px); }
        .btn-cta:disabled { opacity:.5; cursor:default; box-shadow:none; transform:none; }
      `}</style>

      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(16px)', background:'rgba(6,6,12,.88)', padding:'0 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
          <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>
              <span style={{ color:C }}>SET</span><span style={{ color:M }}>FORGE</span>
            </div>
            <div style={{ fontSize:12, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>/ ADMIN</div>
          </Link>
          <UserButton />
        </div>
      </nav>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px' }}>
        {!isLoaded ? null : !isSignedIn ? (
          <div style={cardStyle}>Sign in to view this page.</div>
        ) : forbidden ? (
          <div style={cardStyle}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Not authorized</div>
            <div style={{ color:'#8a8aa6', fontSize:14 }}>This page is only visible to admin accounts.</div>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:1, marginBottom:24 }}>
              Trending Tracks Pipeline
            </h1>

            {spotifyParam && SPOTIFY_BANNER[spotifyParam] && (
              <div style={{ ...cardStyle, marginBottom:20, fontSize:13, color: SPOTIFY_BANNER[spotifyParam].ok ? '#4ade80' : M }}>
                {SPOTIFY_BANNER[spotifyParam].text}
              </div>
            )}

            <div style={{ ...cardStyle, marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
              <div>
                <div style={{ fontSize:13, color:'#8a8aa6' }}>Spotify account</div>
                <div style={{ fontSize:18, fontWeight:700, color: status?.spotifyConnected ? '#4ade80' : M }}>
                  {loading ? '…' : status?.spotifyConnected ? '✓ Connected' : 'Not connected'}
                </div>
                <div style={{ fontSize:12, color:'#6a6a8a', marginTop:4, maxWidth:360 }}>
                  Reading Spotify&apos;s editorial playlists requires a real logged-in Spotify account — an app-only token isn&apos;t allowed to read them.
                </div>
              </div>
              <a href="/api/admin/spotify/login" style={{ textDecoration:'none' }}>
                <button className="btn-cta" style={{ padding:'10px 20px', borderRadius:8, fontSize:14 }}>
                  {status?.spotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify'}
                </button>
              </a>
            </div>

            <div style={{ ...cardStyle, marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
              <div>
                <div style={{ fontSize:13, color:'#8a8aa6' }}>Last refreshed</div>
                <div style={{ fontSize:18, fontWeight:700 }}>
                  {loading ? '…' : timeAgo(status?.lastRefreshed ?? null)}
                </div>
              </div>
              <div>
                <div style={{ fontSize:13, color:'#8a8aa6' }}>Total trending tracks</div>
                <div style={{ fontSize:18, fontWeight:700 }}>{loading ? '…' : status?.totalTracks ?? 0}</div>
              </div>
              <button className="btn-cta" disabled={refreshing} onClick={handleRefresh}
                style={{ padding:'10px 20px', borderRadius:8, fontSize:14 }}>
                {refreshing ? 'Refreshing…' : '↻ Refresh Now'}
              </button>
            </div>

            {refreshMsg && (
              <div style={{ ...cardStyle, marginBottom:20, fontSize:13, color: refreshMsg.startsWith('Failed') ? M : '#4ade80' }}>
                {refreshMsg}
              </div>
            )}

            {refreshErrors.length > 0 && (
              <div style={{ ...cardStyle, marginBottom:20 }}>
                <div style={{ fontSize:13, color:M, fontWeight:700, marginBottom:10 }}>
                  {refreshErrors.length} playlist{refreshErrors.length === 1 ? '' : 's'} failed
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {refreshErrors.map((e, i) => (
                    <div key={i} style={{ fontSize:12, color:'#8a8aa6', fontFamily:'JetBrains Mono,monospace' }}>
                      <span style={{ color:'#e8e8f0' }}>{e.genre}</span> ({e.playlistId}): {e.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={cardStyle}>
              <div style={{ fontSize:13, color:'#8a8aa6', marginBottom:14 }}>By genre</div>
              {!status?.byGenre.length ? (
                <div style={{ fontSize:14, color:'#6a6a8a' }}>
                  No data yet — this cron runs daily at 6am UTC, or hit &quot;Refresh Now&quot; above.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {status.byGenre.map(g => (
                    <div key={g.genre} style={{ display:'flex', justifyContent:'space-between', fontSize:14, padding:'6px 0', borderBottom:'1px solid #1a1a2e' }}>
                      <span>{g.genre}</span>
                      <span style={{ color:C, fontFamily:'JetBrains Mono,monospace' }}>{g.trackCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
