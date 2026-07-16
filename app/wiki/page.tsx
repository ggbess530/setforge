// ▸ Create folder: app/wiki/
// ▸ Place at:      app/wiki/page.tsx
// Public DJ glossary/wiki — no auth required (SEO + content-marketing surface,
// same philosophy as /feedback: reachable by signed-out visitors). Content is
// a static hand-authored data file (lib/glossary-data.ts), no DB/API cost.
// Deep-linkable via #slug so other pages/marketing can link straight to a term.

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useAuth, UserButton } from '@clerk/nextjs'
import NotificationBell from '../components/NotificationBell'
import { GLOSSARY, CATEGORIES, type GlossaryCategory, type GlossaryTerm } from '../../lib/glossary-data'

const C = '#00f0ff'
const M = '#ff1e8a'

const CATEGORY_ICON: Record<GlossaryCategory, string> = {
  'Mixing Fundamentals': '🎚️',
  'Harmony & Key': '🎹',
  'Track Anatomy': '🌊',
  'Gear & Software': '🖥️',
  'Genres & Styles': '🎶',
  'Gigging & Business': '💼',
  'SetForge Terms': '⚡',
}

function TermCard({ t, highlighted }: { t: GlossaryTerm; highlighted: boolean }) {
  return (
    <div
      id={t.slug}
      className={highlighted ? 'wiki-card wiki-card-hl' : 'wiki-card'}
      style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 14, padding: '18px 20px', scrollMarginTop: 90 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#e8e8f0' }}>{t.term}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5, color: '#6a6a8a', padding: '3px 9px', borderRadius: 999, border: '1px solid #23233a', whiteSpace: 'nowrap' }}>
            {CATEGORY_ICON[t.category]} {t.category}
          </span>
          <a href={`#${t.slug}`} title="Copy link to this term" style={{ color: '#4a4a66', textDecoration: 'none', fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }}>#</a>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: '#b8b8d0' }}>{t.definition}</p>
      {t.tip && (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: `${C}0d`, border: `1px solid ${C}2a`, fontSize: 12.5, lineHeight: 1.55, color: '#9adfe6' }}>
          <strong style={{ color: C }}>Tip:</strong> {t.tip}
        </div>
      )}
    </div>
  )
}

export default function WikiPage() {
  const { isSignedIn } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | 'All'>('All')
  const [highlightSlug, setHighlightSlug] = useState<string | null>(null)
  const didHashScroll = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Deep-link support: /wiki#beatmatching scrolls to + briefly highlights the term
  useEffect(() => {
    if (didHashScroll.current) return
    const slug = window.location.hash.replace('#', '')
    if (!slug) return
    const entry = GLOSSARY.find(g => g.slug === slug)
    if (!entry) return
    didHashScroll.current = true
    const t = setTimeout(() => {
      document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightSlug(slug)
      setTimeout(() => setHighlightSlug(null), 2200)
    }, 60)
    return () => clearTimeout(t)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GLOSSARY.filter(t => {
      if (activeCategory !== 'All' && t.category !== activeCategory) return false
      if (!q) return true
      return t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    })
  }, [query, activeCategory])

  const grouped = useMemo(() => {
    if (activeCategory !== 'All') return null
    const map = new Map<GlossaryCategory, GlossaryTerm[]>()
    for (const cat of CATEGORIES) map.set(cat, [])
    for (const t of filtered) map.get(t.category)!.push(t)
    return CATEGORIES.map(cat => ({ cat, items: map.get(cat)! })).filter(g => g.items.length > 0)
  }, [filtered, activeCategory])

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: '#e8e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .wiki-input { background:#0d0d18; border:1px solid #1f1f33; color:#e8e8f0; font-family:'Inter',system-ui,sans-serif; font-size:14px; padding:12px 16px; border-radius:10px; width:100%; outline:none; transition:.2s; box-sizing:border-box; }
        .wiki-input:focus { border-color:${C}; box-shadow:0 0 0 3px ${C}18; }
        .wiki-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; text-decoration:none; }
        .wiki-btn-ghost:hover { border-color:${C}; color:${C}; }
        .wiki-pill { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:11.5px; letter-spacing:.3px; padding:7px 13px; border-radius:999px; white-space:nowrap; transition:.15s; }
        .wiki-pill:hover { border-color:${C}77; color:#c8c8e0; }
        .wiki-pill-active { background:linear-gradient(100deg,${M},${C}); border-color:transparent; color:#06060c; font-weight:700; }
        .wiki-card { transition: box-shadow .3s, border-color .3s; }
        .wiki-card-hl { border-color:${C} !important; box-shadow:0 0 0 3px ${C}33; }
        .wiki-cat-scroll::-webkit-scrollbar { height:0; }
        * { box-sizing:border-box; }
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(16px)', background: 'rgba(6,6,12,.88)', padding: isMobile ? '0 12px' : '0 24px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: isMobile ? 20 : 24, letterSpacing: 2 }}>
              <span style={{ color: C }}>SET</span><span style={{ color: M }}>FORGE</span>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: isMobile ? 6 : 10, alignItems: 'center' }}>
            <Link href="/app" className="wiki-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12 }}>⚡{!isMobile && ' Forge'}</Link>
            {isSignedIn && <NotificationBell />}
            {isSignedIn ? <UserButton /> : <Link href="/sign-in"><button className="wiki-btn-ghost" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12 }}>Sign in</button></Link>}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: isMobile ? '32px 14px 70px' : '52px 24px 90px' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 11, color: M, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 3, marginBottom: 10 }}>BEGINNER-FRIENDLY · NO JARGON LEFT UNEXPLAINED</div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(34px,6vw,54px)', margin: '0 0 10px', letterSpacing: 1, lineHeight: 1 }}>
            <span style={{ color: C }}>DJ</span> <span style={{ color: M }}>WIKI</span>
          </h1>
          <p style={{ fontSize: 13.5, color: '#8a8aa8', margin: '0 auto', maxWidth: 520, lineHeight: 1.6 }}>
            {GLOSSARY.length} terms and techniques every DJ runs into, explained plainly — from beatmatching basics to booking your first gig.
          </p>
        </div>

        <input
          className="wiki-input"
          placeholder="Search terms — e.g. “camelot”, “breakdown”, “B2B”…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div className="wiki-cat-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 26 }}>
          <button className={activeCategory === 'All' ? 'wiki-pill wiki-pill-active' : 'wiki-pill'} onClick={() => setActiveCategory('All')}>All</button>
          {CATEGORIES.map(cat => (
            <button key={cat} className={activeCategory === cat ? 'wiki-pill wiki-pill-active' : 'wiki-pill'} onClick={() => setActiveCategory(cat)}>
              {CATEGORY_ICON[cat]} {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed #1a1a2e', borderRadius: 16, color: '#6a6a8a', fontSize: 13 }}>
            No terms match &ldquo;{query}&rdquo;. Try a different search, or <button className="wiki-btn-ghost" style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12 }} onClick={() => { setQuery(''); setActiveCategory('All') }}>clear filters</button>.
          </div>
        )}

        {grouped ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
            {grouped.map(({ cat, items }) => (
              <div key={cat}>
                <h2 style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1.5, color: '#6a6a8a', marginBottom: 12, textTransform: 'uppercase' }}>
                  {CATEGORY_ICON[cat]} {cat}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(t => <TermCard key={t.slug} t={t} highlighted={highlightSlug === t.slug} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(t => <TermCard key={t.slug} t={t} highlighted={highlightSlug === t.slug} />)}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 56, paddingTop: 30, borderTop: '1px solid #16162a' }}>
          <p style={{ fontSize: 13, color: '#6a6a8a', marginBottom: 14 }}>Know the terms — now let SetForge put them to work in a set built for you.</p>
          <Link href="/app"><button className="wiki-btn-ghost" style={{ padding: '11px 26px', borderRadius: 10, fontSize: 13, borderColor: C, color: C }}>⚡ Open SetForge →</button></Link>
        </div>
      </div>
    </div>
  )
}
