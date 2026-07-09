// ▸ Create folder: app/live/
// ▸ Place at:      app/live/page.tsx
// ▸ Second-screen live view — loads a saved set and shows current/next
//   track + mix notes, glanceable from a DJ booth. Launch via /live?id=<setId>

'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const C = '#00f0ff'
const M = '#ff1e8a'
const CAM_HUES = [0,30,60,90,120,150,180,210,240,270,300,330]

type Track   = { n:number; artist:string; title:string; bpm:number; key:string; energy:number; transition:string }
type SetData = { title:string; summary:string; tracks:Track[]; meta?:{ genre?:string; crowd?:string } }

function keyHue(key: string): number {
  const m = (key || '').match(/^(\d+)([AB])$/)
  return m ? CAM_HUES[parseInt(m[1]) - 1] : 0
}

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// WakeLockSentinel isn't in the default TS lib yet — narrow, local shape.
type WakeLockSentinel = { release: () => Promise<void> }

function LiveSetContent() {
  const params = useSearchParams()
  const id = params.get('id')

  const [setData, setSetData] = useState<SetData | null>(null)
  const [loading, setLoading] = useState(() => !!id)
  const [error,   setError]   = useState<string | null>(() => id ? null : 'No set specified — open Live View from a saved set in your library.')
  const [index,   setIndex]   = useState(0)
  const [started, setStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [quota, setQuota] = useState<{ tier:string } | null>(null)

  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const startRef    = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/quota').then(r => r.json()).then(d => { if (!d.error) setQuota(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/library/item?id=${id}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setError(data.error || 'Set not found.'); return }
        setSetData({ ...data.set.set_data, meta: data.set.meta })
      })
      .catch(() => setError('Failed to load set. Are you signed in?'))
      .finally(() => setLoading(false))
  }, [id])

  const tracks  = setData?.tracks ?? []
  const current = tracks[index]
  const upNext  = tracks[index + 1]

  const [bangerLoading, setBangerLoading] = useState(false)
  const [bangerError,   setBangerError]   = useState<string | null>(null)

  async function fireBanger() {
    if (!current || bangerLoading) return
    if (quota?.tier === 'free') { setBangerError('The Banger button is a Pro feature.'); return }
    setBangerLoading(true); setBangerError(null)
    try {
      const res  = await fetch('/api/banger', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        current:  { artist:current.artist, title:current.title, bpm:current.bpm, key:current.key },
        existing: tracks.map(t => ({ artist:t.artist, title:t.title })),
        genre:    setData?.meta?.genre,
        crowd:    setData?.meta?.crowd,
      }) })
      const data = await res.json()
      if (!res.ok) { setBangerError(data.error || 'Failed to find a banger.'); return }

      setSetData(s => {
        if (!s) return s
        const insertAt = index + 1
        const newTracks = [...s.tracks]
        newTracks.splice(insertAt, 0, {
          n:          0,
          artist:     data.track.artist,
          title:      data.track.title,
          bpm:        data.track.bpm,
          key:        data.track.key,
          energy:     data.track.energy ?? 10,
          transition: data.track.transition ?? '',
        })
        return { ...s, tracks: newTracks.map((t, i) => ({ ...t, n: i + 1 })) }
      })
    } catch {
      setBangerError('Network error.')
    } finally {
      setBangerLoading(false)
    }
  }

  const goNext = useCallback(() => setIndex(i => Math.min(i + 1, tracks.length - 1)), [tracks.length])
  const goPrev = useCallback(() => setIndex(i => Math.max(i - 1, 0)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // Elapsed set clock
  useEffect(() => {
    if (!started) return
    startRef.current = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current!) / 1000)), 1000)
    return () => clearInterval(t)
  }, [started])

  // Re-acquire the screen wake lock whenever the tab becomes visible again
  // (it auto-releases when backgrounded — normal browser behaviour, not a bug).
  useEffect(() => {
    if (!started) return
    async function requestLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        }
      } catch { /* wake lock unsupported or denied — live view still works, screen just may dim */ }
    }
    function onVisible() { if (document.visibilityState === 'visible') requestLock() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [started])

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  async function startLive() {
    setStarted(true)
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock.request('screen')
      }
    } catch { /* ignore — non-critical */ }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif", display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        .sf-display { font-family:'Bebas Neue',sans-serif; }
        .sf-mono    { font-family:'JetBrains Mono',monospace; }
        .live-btn   { background:transparent; border:1.5px solid #2a2a42; color:#e8e8f0; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.15s; }
        .live-btn:hover:not(:disabled) { border-color:${C}; color:${C}; }
        .live-btn:disabled { opacity:.3; cursor:default; }
        .live-nav   { background:linear-gradient(110deg,${M},${C}); color:#06060c; font-weight:800; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:transform .1s,box-shadow .2s; }
        .live-nav:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 30px ${C}44; }
        .live-nav:disabled { opacity:.25; cursor:default; transform:none; box-shadow:none; }
        .live-banger:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 30px #ff5e1a44; }
        * { box-sizing:border-box; }
      `}</style>

      {loading && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#6a6a8a', fontSize:13 }} className="sf-mono">
          LOADING SET…
        </div>
      )}

      {!loading && error && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24, textAlign:'center' }}>
          <div style={{ fontSize:40, opacity:.3 }}>◈</div>
          <div style={{ color:'#9a9ab8', fontSize:14, maxWidth:340 }}>{error}</div>
          <Link href="/app" style={{ textDecoration:'none' }}>
            <button className="live-btn" style={{ padding:'12px 26px', borderRadius:10, fontSize:13 }}>← Back to SetForge</button>
          </Link>
        </div>
      )}

      {!loading && !error && setData && tracks.length === 0 && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#6a6a8a', fontSize:14 }}>
          This set has no tracks.
        </div>
      )}

      {!loading && !error && setData && tracks.length > 0 && !started && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:22, padding:24, textAlign:'center' }}>
          <div className="sf-mono" style={{ fontSize:11, color:M, letterSpacing:3 }}>LIVE SET VIEW</div>
          <h1 className="sf-display" style={{ fontSize:'clamp(32px,6vw,56px)', margin:0, color:C, letterSpacing:1 }}>{setData.title}</h1>
          <p style={{ color:'#8a8aa8', fontSize:14, maxWidth:420 }}>{tracks.length} tracks · Keeps this screen awake and shows current / next track with mix notes.</p>
          <button className="live-nav" onClick={startLive} style={{ padding:'18px 46px', borderRadius:14, fontSize:17 }}>▶ Start Live Session</button>
          <Link href="/app" style={{ textDecoration:'none' }}>
            <button className="live-btn" style={{ padding:'10px 20px', borderRadius:10, fontSize:12 }}>← Back</button>
          </Link>
        </div>
      )}

      {!loading && !error && setData && tracks.length > 0 && started && current && (
        <>
          {/* top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 22px', borderBottom:'1px solid #16162a', flexShrink:0 }}>
            <div className="sf-mono" style={{ fontSize:11, color:'#4a4a66', letterSpacing:1 }}>
              TRACK <span style={{ color:C }}>{index + 1}</span> / {tracks.length} · <span style={{ color:'#6a6a8a' }}>{fmtClock(elapsed)}</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="live-btn" onClick={toggleFullscreen} style={{ padding:'6px 12px', borderRadius:8, fontSize:11 }}>
                {isFullscreen ? '⤢ Exit fullscreen' : '⛶ Fullscreen'}
              </button>
              <Link href="/app" style={{ textDecoration:'none' }}>
                <button className="live-btn" style={{ padding:'6px 12px', borderRadius:8, fontSize:11 }}>✕ Exit</button>
              </Link>
            </div>
          </div>

          {/* main */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 24px', gap:26, overflowY:'auto' }}>

            {/* now playing */}
            <div style={{ textAlign:'center', maxWidth:760 }}>
              <div className="sf-mono" style={{ fontSize:12, color:M, letterSpacing:4, marginBottom:14 }}>NOW PLAYING</div>
              <div className="sf-display" style={{ fontSize:'clamp(34px,7vw,72px)', lineHeight:1.05, color:'#e8e8f0', letterSpacing:.5, marginBottom:8 }}>
                {current.title}
              </div>
              <div style={{ fontSize:'clamp(16px,2.4vw,22px)', color:'#9a9ab8', marginBottom:22 }}>{current.artist}</div>
              <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
                <div className="sf-mono" style={{ fontSize:'clamp(22px,3vw,30px)', color:C, background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:14, padding:'10px 26px' }}>
                  {current.bpm} <span style={{ fontSize:13, color:'#5a5a78' }}>BPM</span>
                </div>
                <div className="sf-mono" style={{ fontSize:'clamp(22px,3vw,30px)', display:'flex', alignItems:'center', gap:10, background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:14, padding:'10px 26px' }}>
                  <span style={{ width:14, height:14, borderRadius:'50%', background:`hsl(${keyHue(current.key)},85%,58%)`, boxShadow:`0 0 10px hsl(${keyHue(current.key)},85%,58%)`, flexShrink:0 }} />
                  {current.key}
                </div>
                <div className="sf-mono" style={{ fontSize:'clamp(22px,3vw,30px)', color:'#8a8aa8', background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:14, padding:'10px 26px' }}>
                  E{current.energy}
                </div>
              </div>
            </div>

            {/* up next + mix note */}
            {upNext ? (
              <div style={{ width:'100%', maxWidth:640, background:'#0a0a14', border:`1.5px solid ${C}33`, borderRadius:20, padding:'22px 28px' }}>
                <div className="sf-mono" style={{ fontSize:11, color:C, letterSpacing:3, marginBottom:10 }}>UP NEXT</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'#e8e8f0' }}>{upNext.title}</div>
                  <div style={{ fontSize:14, color:'#8a8aa8' }}>{upNext.artist}</div>
                </div>
                <div className="sf-mono" style={{ display:'flex', gap:14, fontSize:13, color:'#8a8aa8', marginBottom:16 }}>
                  <span style={{ color:C }}>{upNext.bpm} BPM</span>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:`hsl(${keyHue(upNext.key)},85%,58%)` }} />
                    {upNext.key}
                  </span>
                </div>
                {upNext.transition && (
                  <div style={{ background:`${M}0e`, border:`1px solid ${M}33`, borderRadius:12, padding:'14px 18px' }}>
                    <div className="sf-mono" style={{ fontSize:10, color:M, letterSpacing:2, marginBottom:6 }}>💡 HOW TO MIX IT IN</div>
                    <div style={{ fontSize:15, color:'#c8c8e0', lineHeight:1.6 }}>{upNext.transition}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ width:'100%', maxWidth:640, textAlign:'center', background:'#0a0a14', border:`1.5px solid ${M}33`, borderRadius:20, padding:'22px 28px' }}>
                <div style={{ fontSize:28, marginBottom:6 }}>🏁</div>
                <div style={{ fontSize:15, color:'#c8c8e0' }}>Final track — bring it home.</div>
              </div>
            )}
          </div>

          {/* banger */}
          <div style={{ padding:'0 22px 14px', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            {quota?.tier === 'free' ? (
              <Link href="/#pricing" style={{ textDecoration:'none', width:'100%', maxWidth:640 }}>
                <button className="live-btn" style={{ width:'100%', padding:'16px 0', borderRadius:14, fontSize:15, fontWeight:700, letterSpacing:1 }}>
                  🔒 BANGER — Pro feature, upgrade to unlock
                </button>
              </Link>
            ) : (
              <button className="live-banger" onClick={fireBanger} disabled={bangerLoading}
                style={{ width:'100%', maxWidth:640, padding:'16px 0', borderRadius:14, fontSize:15, fontWeight:800, letterSpacing:1,
                  background:'linear-gradient(110deg,#ff5e1a,#ffb020)', color:'#1a0800', border:'none', cursor:bangerLoading?'default':'pointer',
                  opacity:bangerLoading?.7:1, transition:'transform .1s,box-shadow .2s' }}>
                {bangerLoading ? '🔥 FINDING A BANGER…' : '🔥 BANGER — insert a hype track next'}
              </button>
            )}
            {bangerError && <div style={{ fontSize:11, color:M, textAlign:'center' }}>{bangerError}</div>}
          </div>

          {/* progress dots */}
          <div style={{ display:'flex', gap:5, justifyContent:'center', padding:'0 22px 10px', flexShrink:0 }}>
            {tracks.map((_, i) => (
              <div key={i} style={{ width: i===index?22:7, height:7, borderRadius:4, background: i===index?C:i<index?'#2a2a42':'#16162a', transition:'.2s' }} />
            ))}
          </div>

          {/* controls */}
          <div style={{ display:'flex', gap:12, padding:'0 22px 24px', flexShrink:0 }}>
            <button className="live-nav" onClick={goPrev} disabled={index===0} style={{ flex:1, padding:'20px 0', borderRadius:16, fontSize:16 }}>← PREV</button>
            <button className="live-nav" onClick={goNext} disabled={index===tracks.length-1} style={{ flex:2, padding:'20px 0', borderRadius:16, fontSize:16 }}>NEXT →</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function LiveSetPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', background:'#06060c' }} />}>
      <LiveSetContent />
    </Suspense>
  )
}
