// ▸ Create folder: app/s/
// ▸ Place at:      app/s/page.tsx
// ▸ Share links look like: setforge.online/s?id=x7Kp2mQ9

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { generateSetPdf, viewPdfInNewTab } from '@/lib/pdf-export'

const C = '#00f0ff'
const M = '#ff1e8a'
const CAM_HUES = [0,30,60,90,120,150,180,210,240,270,300,330]

type Track = { n:number; artist:string; title:string; bpm:number; key:string; energy:number; transition:string }

function SharedSetContent() {
  const searchParams = useSearchParams()
  const shareId = searchParams.get('id')

  const [set,     setSet]     = useState<{ title:string; set_data:{ title:string; summary:string; tracks:Track[] }; meta:Record<string,string|number> } | null>(null)
  const [loading, setLoading] = useState(() => !!shareId)
  const [error,   setError]   = useState<string|null>(() => shareId ? null : 'Invalid share link.')
  const [pdfBusy, setPdfBusy] = useState(false)

  function viewPdf() {
    if (!set) return
    setPdfBusy(true)
    try {
      const blob = generateSetPdf(set.set_data.title, set.set_data.summary, set.set_data.tracks, [set.meta?.genre, set.meta?.crowd, set.meta?.familiarity || set.meta?.arc])
      viewPdfInNewTab(blob)
    } finally { setPdfBusy(false) }
  }

  useEffect(() => {
    if (!shareId) return
    fetch(`/api/share?id=${shareId}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.error || 'Set not found.')
        else setSet(data.set)
      })
      .catch(() => setError('Failed to load set.'))
      .finally(() => setLoading(false))
  }, [shareId])

  const tracks = set?.set_data?.tracks ?? []

  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", overflowX:'hidden' }}>
      <style>{`
        .sf-display { font-family:'Bebas Neue',sans-serif; }
        .glow-c { text-shadow:0 0 8px ${C},0 0 24px ${C}80; }
        .glow-m { text-shadow:0 0 8px ${M},0 0 24px ${M}80; }
        .btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; letter-spacing:2px; transition:box-shadow .2s; }
        .btn-primary:hover { box-shadow:0 0 28px ${C}66,0 0 28px ${M}44; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>

      {/* bg */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C}0a 1px,transparent 1px),linear-gradient(90deg,${C}0a 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 0%,black,transparent 75%)', pointerEvents:'none' }} />

      {/* nav */}
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(12px)', background:'#06060ccc', padding:'0 24px' }}>
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
          <Link href="/" style={{ textDecoration:'none' }}>
            <div className="sf-display" style={{ fontSize:28, letterSpacing:2 }}>
              <span className="glow-c" style={{ color:C }}>SET</span><span className="glow-m" style={{ color:M }}>FORGE</span>
            </div>
          </Link>
          <Link href="/" style={{ textDecoration:'none' }}>
            <button className="btn-primary" style={{ padding:'8px 18px', borderRadius:8, fontSize:11 }}>⚡ FORGE YOUR OWN</button>
          </Link>
        </div>
      </nav>

      <div style={{ position:'relative', maxWidth:760, margin:'0 auto', padding:'48px 20px 80px' }}>

        {loading && (
          <div style={{ textAlign:'center', padding:80, color:'#6a6a8a', fontSize:12, letterSpacing:2, animation:'pulse 1.2s infinite' }}>
            LOADING SET…
          </div>
        )}

        {error && (
          <div style={{ textAlign:'center', padding:80 }}>
            <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>◈</div>
            <div style={{ color:'#9a9ab8', fontSize:14, marginBottom:20 }}>{error}</div>
            <Link href="/" style={{ textDecoration:'none' }}>
              <button className="btn-primary" style={{ padding:'12px 28px', borderRadius:8, fontSize:12 }}>GO TO SETFORGE</button>
            </Link>
          </div>
        )}

        {set && (
          <>
            {/* header */}
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:10, letterSpacing:5, color:M, marginBottom:8 }} className="glow-m">SHARED SET</div>
              <h1 className="sf-display glow-c" style={{ fontSize:48, margin:0, letterSpacing:1, color:C }}>
                {set.set_data.title}
              </h1>
              <p style={{ fontSize:13, color:'#9a9ab8', maxWidth:480, margin:'10px auto 14px', lineHeight:1.6 }}>
                {set.set_data.summary}
              </p>
              <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap', marginBottom:16 }}>
                {[set.meta?.genre, set.meta?.crowd, set.meta?.familiarity || set.meta?.arc].map(tag => tag && (
                  <span key={String(tag)} style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'3px 10px' }}>{String(tag)}</span>
                ))}
              </div>
              <button onClick={viewPdf} disabled={pdfBusy} className="btn-primary" style={{ padding:'8px 20px', borderRadius:8, fontSize:11 }}>
                {pdfBusy ? 'GENERATING…' : '📄 VIEW AS PDF'}
              </button>
            </div>

            {/* energy bar */}
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:52, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:'6px 10px', marginBottom:20 }}>
              {tracks.map((t,i) => (
                <div key={i} title={`E${t.energy}`} style={{ flex:1, height:`${(t.energy/10)*100}%`, minHeight:3, background:`linear-gradient(180deg,${M},${C})`, borderRadius:2, opacity:.85 }} />
              ))}
            </div>

            {/* tracks */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {tracks.map(t => {
                const m   = (t.key||'').match(/^(\d+)([AB])$/)
                const hue = m ? CAM_HUES[parseInt(m[1])-1] : 0
                return (
                  <div key={t.n} style={{ display:'grid', gridTemplateColumns:'34px 1fr auto', gap:12, alignItems:'center', background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:'12px 16px' }}>
                    <div className="sf-display glow-m" style={{ fontSize:22, color:M }}>{String(t.n).padStart(2,'0')}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700 }}>{t.title}</div>
                      <div style={{ fontSize:12, color:'#8a8aa8' }}>{t.artist}</div>
                      <div style={{ fontSize:11, color:'#5a5a78', marginTop:3 }}>↳ {t.transition}</div>
                    </div>
                    <div style={{ textAlign:'right', fontSize:12, lineHeight:1.7 }}>
                      <div style={{ color:C }}>{t.bpm} <span style={{ color:'#5a5a78' }}>BPM</span></div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:`hsl(${hue},85%,58%)`, boxShadow:`0 0 5px hsl(${hue},85%,58%)` }} />
                        {t.key}
                      </div>
                      <div style={{ color:'#5a5a78' }}>E{t.energy}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CTA footer */}
            <div style={{ textAlign:'center', marginTop:40, padding:28, background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16 }}>
              <div className="sf-display" style={{ fontSize:28, letterSpacing:1, marginBottom:8 }}>
                <span className="glow-c" style={{ color:C }}>WANT A SET LIKE THIS?</span>
              </div>
              <p style={{ fontSize:13, color:'#6a6a8a', marginBottom:20 }}>
                Forge AI-curated DJ sets with BPM matching, harmonic keys, and energy shaping — free 7-day trial.
              </p>
              <Link href="/" style={{ textDecoration:'none' }}>
                <button className="btn-primary" style={{ padding:'14px 36px', borderRadius:10, fontSize:13 }}>⚡ START FORGING FREE</button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function SharedSetPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#06060c' }} />}>
      <SharedSetContent />
    </Suspense>
  )
}