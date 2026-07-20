// ▸ Replace: app/page.tsx
'use client'

import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import ExampleGallery from './components/ExampleGallery'
import NotificationBell from './components/NotificationBell'

const C = '#00f0ff'
const M = '#ff1e8a'

// ── Scroll-reveal wrapper ────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref  = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el  = ref.current; if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect() } },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      opacity:    v ? 1 : 0,
      transform:  v ? 'none' : 'translateY(28px)',
      transition: `opacity 0.7s ${delay}ms cubic-bezier(.16,1,.3,1), transform 0.7s ${delay}ms cubic-bezier(.16,1,.3,1)`,
    }}>{children}</div>
  )
}

// ── Count-up number ──────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref      = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(0)
  const [go, setGo] = useState(false)
  useEffect(() => {
    const el  = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setGo(true); obs.disconnect() } }, { threshold: 0.5 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  useEffect(() => {
    if (!go) return
    const dur = 1400, start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      setN(Math.round((1 - Math.pow(1 - t, 3)) * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [go, target])
  return <span ref={ref}>{n}{suffix}</span>
}

// ── Typewriter genre cycler ───────────────────────────────────
const HERO_GENRES = ['Tech House', 'Techno', 'Afro House', 'Drum & Bass', 'Trance', 'Hip Hop', 'Disco / Funk']

function TypewriterGenre() {
  const [genreIndex, setGenreIndex] = useState(0)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing')

  useEffect(() => {
    const current = HERO_GENRES[genreIndex]
    let timeout: ReturnType<typeof setTimeout>

    if (phase === 'typing') {
      if (text.length < current.length) {
        timeout = setTimeout(() => setText(current.slice(0, text.length + 1)), 65)
      } else {
        timeout = setTimeout(() => setPhase('pausing'), 1400)
      }
    } else if (phase === 'pausing') {
      timeout = setTimeout(() => setPhase('deleting'), 100)
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => setText(text.slice(0, -1)), 30)
      } else {
        timeout = setTimeout(() => {
          setGenreIndex(i => (i + 1) % HERO_GENRES.length)
          setPhase('typing')
        }, 0)
      }
    }
    return () => clearTimeout(timeout)
  }, [text, phase, genreIndex])

  return (
    <span style={{ color: C, fontWeight: 700 }}>
      {text}<span className="typewriter-cursor">|</span>
    </span>
  )
}

// ── Hero waveform accent ────────────────────────────────────────
function HeroWaveform() {
  const heights = [14, 26, 42, 56, 36, 62, 44, 24, 16]
  return (
    <div className="hero-item" style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:5, height:62, marginBottom:22, animationDelay:'0ms' }}>
      {heights.map((h, i) => (
        <span key={i} className="wave-bar" style={{
          width:6, height:h, borderRadius:3,
          background: i % 2 === 0 ? `linear-gradient(180deg,${C},${M})` : `linear-gradient(180deg,${M},${C})`,
          animationDelay: `${i * 90}ms`,
        }} />
      ))}
    </div>
  )
}

// ── Tool card mini previews ────────────────────────────────────
function ForgePreview() {
  const rows = [
    { n:1, title:'Losing It',           artist:'Fisher',     bpm:125, key:'7A' },
    { n:2, title:'Turn Off The Lights', artist:'Chris Lake', bpm:125, key:'8A' },
    { n:3, title:'San Frandisco',       artist:'Dom Dolla',  bpm:126, key:'8A' },
  ]
  return (
    <div style={{ background:'#06060c', border:'1px solid #14142a', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:7, position:'relative', overflow:'hidden' }}>
      {rows.map(r => (
        <div key={r.n} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
          <span className="sf-mono" style={{ color:M, width:14, flexShrink:0 }}>{String(r.n).padStart(2,'0')}</span>
          <span style={{ color:'#c8c8e0', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {r.title} <span style={{ color:'#5a5a78' }}>· {r.artist}</span>
          </span>
          <span className="sf-mono" style={{ color:C, fontSize:10, flexShrink:0 }}>{r.bpm}</span>
          <span className="sf-mono" style={{ color:'#8a8aa8', fontSize:10, flexShrink:0 }}>{r.key}</span>
        </div>
      ))}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:20, background:'linear-gradient(transparent,#06060c)', pointerEvents:'none' }} />
    </div>
  )
}

function AnalyserPreview() {
  const subs = [{ l:'Energy', v:88 }, { l:'Harmony', v:95 }, { l:'BPM Flow', v:80 }]
  return (
    <div style={{ background:'#06060c', border:'1px solid #14142a', borderRadius:10, padding:'12px 14px', display:'flex', gap:14, alignItems:'center' }}>
      <div style={{ textAlign:'center', flexShrink:0 }}>
        <div className="sf-display" style={{ fontSize:32, color:'#4ade80', lineHeight:1 }}>A-</div>
        <div className="sf-mono" style={{ fontSize:8, color:'#4a4a66', letterSpacing:1 }}>OVERALL</div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, minWidth:0 }}>
        {subs.map(s => (
          <div key={s.l}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#6a6a8a', marginBottom:2 }}>
              <span>{s.l}</span><span>{s.v}</span>
            </div>
            <div style={{ height:4, background:'#14142a', borderRadius:2 }}>
              <div style={{ width:`${s.v}%`, height:'100%', borderRadius:2, background:`linear-gradient(90deg,${M},${C})` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MixLabPreview() {
  const score = 87, r = 26, circ = 2 * Math.PI * r
  return (
    <div style={{ background:'#06060c', border:'1px solid #14142a', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ position:'relative', width:60, height:60, flexShrink:0 }}>
        <svg width={60} height={60} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={30} cy={30} r={r} fill="none" stroke="#1a1a2e" strokeWidth={6} />
          <circle cx={30} cy={30} r={r} fill="none" stroke="#4ade80" strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} strokeLinecap="round" />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:17, color:'#4ade80' }}>{score}</div>
      </div>
      <div style={{ minWidth:0 }}>
        <div className="sf-mono" style={{ fontSize:10, color:'#4ade80', fontWeight:700, letterSpacing:1 }}>SMOOTH BLEND</div>
        <div style={{ fontSize:11, color:'#8a8aa8', marginTop:4 }}>7A → 8A · 125→126 BPM</div>
      </div>
    </div>
  )
}

function PlannerPreview() {
  const slots = [{ dj:'DJ A', color:M }, { dj:'DJ B', color:C }, { dj:'DJ C', color:'#a78bfa' }]
  return (
    <div style={{ background:'#06060c', border:'1px solid #14142a', borderRadius:10, padding:'12px 14px 10px' }}>
      <div style={{ display:'flex', gap:6 }}>
        {slots.map((s, i) => (
          <div key={i} style={{ flex:1, textAlign:'center' }}>
            <div style={{ height:8, borderRadius:4, background:`${s.color}33`, border:`1px solid ${s.color}66`, marginBottom:6 }} />
            <div className="sf-mono" style={{ fontSize:9, color:s.color }}>{s.dj}</div>
          </div>
        ))}
      </div>
      <div className="sf-mono" style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:9, color:'#5a5a78' }}>
        <span>9A · 122</span><span>→</span><span>9A · 124</span><span>→</span><span>10A · 126</span>
      </div>
    </div>
  )
}

// ── Data ─────────────────────────────────────────────────────
const TICKER_ITEMS = [
  '✦ No DJ experience needed',
  '✦ AI harmonic key matching',
  '✦ 70+ genres available',
  '✦ Free forever plan',
  '✦ Rekordbox, Serato & Traktor export',
  '✦ Real tracks from real artists',
  '✦ Custom energy curves',
  '✦ 7-day Pro trial',
  '✦ Public set sharing',
  '✦ Grade any tracklist with Analyser',
  '✦ Built-in Mashup Finder',
  '✦ Multi-DJ night planning',
  '✦ Tracks grounded in what’s trending',
  '✦ Drag to reorder tracks',
  '✦ Lock your favourite tracks',
  '✦ Crowd feedback learns your hits',
  '✦ Personal stats dashboard',
  '✦ Public DJ profiles',
  '✦ Community feed for mixes & tips',
  '✦ Team seats for crews & agencies',
  '✦ Built-in DJ Wiki & glossary',
  '✦ Works in any browser',
]

const TOOLS = [
  {
    icon: '⚡', name: 'Forge', href: '/app',
    title: 'Generate a complete DJ set from a description',
    plain: 'The main event — start here if you’re new.',
    desc: 'Pick a genre and crowd, shape the energy curve yourself (or type your own vibe in plain English) and SetForge builds a full tracklist: real songs, matched BPM, compatible musical keys, and notes on exactly how to mix each transition.',
    tag: 'No experience needed',
    preview: ForgePreview,
  },
  {
    icon: '📊', name: 'Analyser', href: '/analyse',
    title: 'Get any tracklist graded like a pro would',
    plain: 'Already built a set yourself? See how it holds up.',
    desc: 'Paste a tracklist from anywhere — your own set, a festival lineup, a friend’s mix — and get a full breakdown: energy flow, harmonic mixing, BPM progression, the weakest transition (and how to fix it), plus an overall grade.',
    tag: 'Works with any format',
    preview: AnalyserPreview,
  },
  {
    icon: '🎛️', name: 'Mix & Mashup Lab', href: '/mix',
    title: 'Test transitions and find mashup-ready pairings',
    plain: 'Wondering if two songs actually work together?',
    desc: 'The Mix Simulator checks whether two tracks blend cleanly before you ever play them live. The Mashup Finder takes one track and surfaces real candidates in compatible keys and BPMs, even across genres.',
    tag: 'Great for creative mixing',
    preview: MixLabPreview,
  },
  {
    icon: '🗓️', name: 'Night Planner', href: '/planner',
    title: 'Coordinate a full night across multiple DJs',
    plain: 'Running an event with more than one DJ on the bill?',
    desc: 'Lay out every slot on a timeline — genre, crowd, energy — and generate a set for each one. SetForge checks the handoff between back-to-back DJs so the key and BPM actually connect when one set ends and the next begins.',
    tag: 'Built for events, not just solo sets',
    preview: PlannerPreview,
  },
]

const FEATURES = [
  { icon:'🎵', title:'Picks the perfect tracks',        plain:'No more hours searching for songs that go together.', desc:"Our AI listens to your vibe — genre, mood, crowd — and selects real tracks that actually flow together. Like having a DJ friend who knows everything." },
  { icon:'🔗', title:'Songs that flow back-to-back',    plain:'Ever heard two songs clash when mixed? This stops that.', desc:"SetForge orders tracks so the musical keys are compatible. Every transition sounds intentional — even if you've never mixed before." },
  { icon:'🔄', title:"Don't like a track? Swap it",     plain:"You're always in control.", desc:"If one track doesn't fit, hit swap. The AI replaces it with something matching the same energy — without breaking the flow." },
  { icon:'📈', title:'Sets that build to a peak',       plain:'Great DJ sets tell a story. Yours will too.', desc:'Choose how your set should feel — slow build, peak time, or cool-down. SetForge shapes every selection around that journey.' },
  { icon:'☁️', title:'Your sets saved forever',         plain:'Come back any time and pick up where you left off.', desc:"Every set is saved to your personal cloud library. Rename them, load them, share them — they're yours forever." },
  { icon:'📤', title:'Ready for your DJ software',      plain:'Works with Rekordbox, Serato, Traktor, and more.', desc:'Export any set straight into your DJ software, or copy and paste it anywhere. One click to take it live.' },
]

const WORKFLOW_FEATURES = [
  { icon:'📁', title:'Bring your own library',          plain:'Already have thousands of tracks tagged in Rekordbox or Serato?', desc:'Import your existing Rekordbox XML, Traktor NML, or Serato crates once — SetForge remembers it permanently and can build sets straight from your own music instead of only suggesting new tracks.' },
  { icon:'💡', title:'"Why this track?" — always explained', plain:'Never wonder why the AI picked something.', desc:'Every track in a generated set can be expanded to see exactly why it was chosen — how it fits the energy, the key, and the vibe you asked for. Nothing is a black box.' },
  { icon:'📡', title:'Grounded in what’s trending right now', plain:'Not just historically famous tracks — what’s actually popping off today.', desc:'SetForge continuously tracks real, currently-charting tracks across genres and weaves relevant, current picks into your set alongside proven classics, so your sets don’t feel stuck in the past.' },
  { icon:'👍', title:'Learns what actually hits with your crowd', plain:'Rate tracks hit or miss after you play them.', desc:'Mark tracks from a saved set as a hit or miss after a real gig, and future sets lean on your proven crowd-pleasers while steering clear of what flopped. It gets sharper every time you play out.' },
  { icon:'📊', title:'A dashboard for your own numbers',  plain:'See your habits at a glance, not buried in a spreadsheet.', desc:'A personal stats page tracks your lifetime sets, genre breakdown, monthly activity, and crowd hit-rate — pulled straight from your own history.' },
  { icon:'💬', title:'A community to share sets and mixes', plain:'Post, get feedback, follow other DJs.', desc:'Share blog-style posts or upload short mix/blend previews, like and comment on other members\' posts, and follow the DJs whose taste you trust.' },
  { icon:'🌐', title:'A public profile that\'s actually yours', plain:'One link for your sets, mixes, and followers.', desc:'Every account gets a public profile showing shared sets, community posts, and follower count — link it in your bio, no separate portfolio needed.' },
  { icon:'👥', title:'Team seats for crews and agencies', plain:'One subscription, up to five people.', desc:'Team-tier subscribers invite up to four teammates onto the same plan — shared library, shared sets feed, no separate billing per seat.' },
  { icon:'📖', title:'A DJ glossary built right in',      plain:'Never Google "what\'s a Camelot wheel" mid-set.', desc:'A free, searchable Wiki covers mixing fundamentals, harmonic theory, gear, and terminology — no account needed, just a fast reference when you need one.' },
  { icon:'🔗', title:'Share it like a mixtape',          plain:'Show off a set without sending a screenshot.', desc:'Every saved set gets a clean public link with the full tracklist and a "Forge Your Own" button — perfect for socials, group chats, or handing off to another DJ.' },
]

const FAQS = [
  { q:'Do I need to be a DJ to use SetForge?', a:"Not at all. SetForge was built with beginners in mind. If you love music and want to build a set — even your first one ever — SetForge does the hard work. No experience needed." },
  { q:'What’s the difference between Forge, Analyser, Mix, and Planner?', a:'Forge builds a brand-new set from scratch — start here. Analyser grades a tracklist you (or someone else) already made. Mix & Mashup Lab checks whether two specific tracks work together, or finds mashup candidates for one. Night Planner coordinates multiple back-to-back DJ sets for an event. Each one solves a different part of putting a set together, and they all work off the same track knowledge under the hood.' },
  { q:'What is BPM and why does it matter?', a:"BPM is Beats Per Minute — basically how fast a song is. Most club music sits between 120–130 BPM. Matching BPMs makes mixes smooth instead of jarring. SetForge handles this automatically." },
  { q:'What is harmonic mixing? Do I need to understand it?', a:"Harmonic mixing means choosing songs in compatible musical keys. Pro DJs spend years learning this. SetForge does it instantly for every track, so you get pro transitions without knowing any music theory." },
  { q:'Do I need DJ equipment or software?', a:"No. SetForge works in any browser on any device. If you have Rekordbox or Serato, you can export directly, or import your existing library so sets are built from music you already own. But you can also just use SetForge to plan and discover music." },
  { q:'Will the AI suggest real songs I can find?', a:"Yes. SetForge picks real, well-known tracks on Beatport, Spotify, and major platforms. Every track has direct search links so you can preview and buy instantly." },
  { q:'What is the energy curve and how do I use it?', a:'The energy curve is an interactive graph you drag to shape how your set builds over time — one point per track. Built-in presets cover common shapes (Slow Build, Peak Time, Cool Down, Rollercoaster, and more), or draw your own from scratch. When in doubt, Slow Build is the most crowd-pleasing.' },
  { q:'How is this different from a Spotify playlist?', a:"A Spotify playlist is just songs in a row. SetForge creates a DJ set — every track chosen for BPM, musical key, energy level, and how it flows into the next one. You also get transition notes telling you exactly how to mix. It's the difference between a list and a performance." },
  { q:'Is there a free plan?', a:"Yes — 5 set generations every month, forever. No credit card, no expiry. You also get a 7-day Pro trial on signup — 30 generations to try the full experience before deciding." },
]

const TIERS = [
  { name:'Free',  price:'$0', period:'forever',  highlight:false, badge:null,          color:'#9a9ab8', desc:'Perfect for getting started.', perks:["5 set generations / month","Sets up to 15 tracks","3 mix uploads (lifetime)","Save to library, export & share"], cta:'Start free — no card needed' },
  { name:'Pro',   price:'$9', period:'/month',   highlight:true,  badge:'Most popular', color:M,         desc:'For DJs creating sets regularly.', perks:['150 set generations / month','Sets up to 50 tracks','"Why this track?" explanations','20 mix uploads / month','Everything in Free'], cta:'Start 7-day free trial' },
  { name:'Team',  price:'$19', period:'/month',  highlight:false, badge:null,          color:C,         desc:'For agencies and DJ teams.', perks:['400 set generations / month, shared','Up to 5 team seats','Shared team library & sets','Everything in Pro'], cta:'Start 7-day free trial' },
]

export default function LandingPage() {
  const { isSignedIn } = useAuth()
  const [openFaq,   setOpenFaq]   = useState<number|null>(null)
  const [upgrading, setUpgrading] = useState<string|null>(null)
  const [isMobile,  setIsMobile]  = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  async function handleUpgrade(tier: string) {
    if (!isSignedIn) return
    setUpgrading(tier)
    try {
      const res  = await fetch('/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      // eslint-disable-next-line react-hooks/immutability -- navigation only ever runs from this click handler, never during render
      if (data.url) window.location.href = data.url
    } catch {}
    finally { setUpgrading(null) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif", overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap');
        .sf-mono    { font-family:'JetBrains Mono',monospace; }
        .sf-display { font-family:'Bebas Neue',sans-serif; }

        /* ── Blobs ── */
        @keyframes blob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-80px) scale(1.08)} 66%{transform:translate(-50px,60px) scale(.94)} }
        @keyframes blob2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-70px,50px) scale(.96)} 66%{transform:translate(50px,-70px) scale(1.06)} }
        @keyframes blob3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,-40px) scale(1.1)} }
        .blob1 { animation:blob1 18s ease-in-out infinite; }
        .blob2 { animation:blob2 22s ease-in-out infinite; }
        .blob3 { animation:blob3 15s ease-in-out infinite; }

        /* ── CTA button — clean gradient, no animation at rest ── */
        .btn-cta {
          background: linear-gradient(110deg,${M},${C});
          color:#06060c; font-weight:700; border:none; cursor:pointer;
          font-family:'Inter',sans-serif;
          box-shadow: 0 4px 24px ${M}28, 0 2px 8px ${C}18;
          transition: box-shadow .25s, transform .15s;
        }
        .btn-cta:hover {
          box-shadow: 0 0 0 3px ${C}44, 0 8px 40px ${C}44, 0 8px 40px ${M}28;
          transform: translateY(-2px);
        }
        /* ── Scrolling ticker ── */
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ticker-track { display:flex; animation:ticker 38s linear infinite; white-space:nowrap; }
        .ticker-track:hover { animation-play-state:paused; }

        /* ── Ghost button ── */
        .btn-ghost { background:transparent; border:1.5px solid #2a2a42; color:#e8e8f0; cursor:pointer; font-family:'Inter',sans-serif; transition:border-color .2s,color .2s,box-shadow .2s,transform .15s; }
        .btn-ghost:hover { border-color:${C}; color:${C}; transform:translateY(-2px); box-shadow:0 0 20px ${C}22; }

        /* ── Logo breathe ── */
        @keyframes logo-breathe { 0%,100%{text-shadow:0 0 12px ${C}66} 50%{text-shadow:0 0 32px ${C}cc,0 0 60px ${C}44} }
        .logo-c { color:${C}; animation:logo-breathe 3s ease-in-out infinite; font-family:'Bebas Neue',sans-serif; }
        @keyframes logo-m-breathe { 0%,100%{text-shadow:0 0 12px ${M}66} 50%{text-shadow:0 0 32px ${M}cc,0 0 60px ${M}44} }
        .logo-m { color:${M}; animation:logo-m-breathe 3s ease-in-out infinite 0.5s; font-family:'Bebas Neue',sans-serif; }

        /* ── Hero text gradient ── */
        @keyframes grad-shift { 0%,100%{background-position:0% center} 50%{background-position:100% center} }
        .hero-grad {
          background: linear-gradient(90deg,${M},${C},#a78bfa,${C},${M});
          background-size:300% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:grad-shift 5s linear infinite;
        }

        /* ── Float ── */
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .float { animation:float 4s ease-in-out infinite; }

        /* ── Hero entrance — staggered via inline animationDelay per element ── */
        @keyframes hero-enter { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:none} }
        .hero-item { animation:hero-enter .8s cubic-bezier(.16,1,.3,1) backwards; }

        /* ── Typewriter cursor ── */
        @keyframes cursor-blink { 0%,45%{opacity:1} 50%,95%{opacity:0} 100%{opacity:1} }
        .typewriter-cursor { animation:cursor-blink 1s step-end infinite; color:${C}; font-weight:400; }

        /* ── Hero waveform ── */
        @keyframes wave-bounce { 0%,100%{transform:scaleY(.42)} 50%{transform:scaleY(1)} }
        .wave-bar { transform-origin:bottom; animation:wave-bounce 1.15s ease-in-out infinite; display:inline-block; }

        /* ── Feature cards ── */
        .feature-card { transition:transform .25s,box-shadow .25s,border-color .25s; cursor:default; }
        .feature-card:hover { transform:translateY(-6px); box-shadow:0 16px 60px rgba(0,240,255,.08); border-color:#2a2a42!important; }
        .feature-icon { display:inline-block; transition:transform .2s; }
        .feature-card:hover .feature-icon { animation:icon-bounce .4s ease; }
        @keyframes icon-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        /* ── Tool cards ── */
        .tool-card { transition:transform .25s,box-shadow .25s,border-color .25s; }
        .tool-card:hover { transform:translateY(-6px); box-shadow:0 20px 70px rgba(0,0,0,.35); border-color:#2a2a42!important; }

        /* ── Tier cards ── */
        .tier-card { transition:transform .2s,box-shadow .2s; }
        .tier-card:hover { transform:translateY(-6px); }
        @keyframes pro-pulse { 0%,100%{box-shadow:0 0 40px ${M}22,0 0 80px ${M}0a} 50%{box-shadow:0 0 70px ${M}44,0 0 140px ${M}1a,0 0 30px ${C}18} }
        .pro-pulse { animation:pro-pulse 3s ease-in-out infinite; }

        /* ── Stat cards ── */
        .stat-card { transition:transform .2s,box-shadow .2s; }
        .stat-card:hover { transform:translateY(-4px); box-shadow:0 8px 32px rgba(0,240,255,.1); }

        /* ── FAQ ── */
        .faq-row { cursor:pointer; transition:background .15s; }
        .faq-row:hover { background:#0e0e1c!important; }
        .faq-answer { overflow:hidden; transition:max-height .35s cubic-bezier(.16,1,.3,1), opacity .3s; }

        /* ── Beginners badge ── */
        @keyframes badge-glow { 0%,100%{box-shadow:0 0 0 0 ${C}00} 50%{box-shadow:0 0 20px 4px ${C}33} }
        .beginners-badge { background:linear-gradient(90deg,${M}22,${C}22); border:1px solid ${C}55; border-radius:999px; animation:badge-glow 3s ease-in-out infinite; }

        /* ── Step connector ── */
        .step-connector { background:linear-gradient(90deg,${M}44,${C}44); height:1px; flex:1; }

        /* ── Grid lines ── */
        .grid-bg { position:fixed; inset:0; background-image:linear-gradient(${C}06 1px,transparent 1px),linear-gradient(90deg,${C}06 1px,transparent 1px); background-size:44px 44px; mask-image:radial-gradient(ellipse at 50% 0%,black,transparent 70%); pointer-events:none; z-index:0; }

        * { box-sizing:border-box; }
        ::selection { background:${C}44; }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#06060c; } ::-webkit-scrollbar-thumb { background:#1f1f38; border-radius:3px; }
      `}</style>

      {/* ── Animated blobs ── */}
      <div className="grid-bg" />
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        <div className="blob1" style={{ position:'absolute', top:'-20%', left:'30%', width:700, height:700, background:`radial-gradient(circle,${M}14,transparent 65%)`, filter:'blur(90px)' }} />
        <div className="blob2" style={{ position:'absolute', bottom:'-10%', left:'-10%', width:600, height:600, background:`radial-gradient(circle,${C}12,transparent 65%)`, filter:'blur(80px)' }} />
        <div className="blob3" style={{ position:'absolute', top:'30%', right:'-5%', width:500, height:500, background:`radial-gradient(circle,#7c3aed14,transparent 65%)`, filter:'blur(70px)' }} />
      </div>

      {/* ── TICKER BAR ── */}
      <div style={{ background:'#08080f', borderBottom:'1px solid #1a1a2e', overflow:'hidden', position:'relative', zIndex:51 }}>
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:60, background:'linear-gradient(90deg,#08080f,transparent)', zIndex:2, pointerEvents:'none' }} />
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:60, background:'linear-gradient(270deg,#08080f,transparent)', zIndex:2, pointerEvents:'none' }} />
        <div className="ticker-track" style={{ padding:'10px 0' }}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{ fontSize:12, color: i % 4 === 0 ? C : i % 4 === 2 ? M : '#6a6a8a', fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5, paddingRight:48, flexShrink:0 }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── NAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(20px)', background:'rgba(6,6,12,.88)', padding: isMobile ? '0 14px' : '0 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height: isMobile ? 56 : 64 }}>
          <div style={{ fontSize: isMobile ? 22 : 30, letterSpacing:2 }}>
            <span className="logo-c">SET</span><span className="logo-m">FORGE</span>
          </div>
          <div style={{ display:'flex', gap: isMobile ? 8 : 10, alignItems:'center' }}>
            {isSignedIn ? (
              <>
                {!isMobile && (
                  <>
                    <Link href="/analyse" style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Analyse</button></Link>
                    <Link href="/mix"     style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Mix</button></Link>
                    <Link href="/planner" style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Planner</button></Link>
                    <Link href="/community" style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Community</button></Link>
                    <Link href="/team" style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Team</button></Link>
                    <Link href="/stats" style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Stats</button></Link>
                    <Link href="/wiki" style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Wiki</button></Link>
                  </>
                )}
                <Link href="/app"><button className="btn-cta" style={{ padding: isMobile ? '8px 14px' : '9px 22px', borderRadius:8, fontSize: isMobile ? 12 : 14, whiteSpace:'nowrap' }}>{isMobile ? 'Open App' : 'Open App →'}</button></Link>
                <NotificationBell />
                <UserButton />
              </>
            ) : (
              <>
                {!isMobile && (
                  <Link href="/wiki" style={{ textDecoration:'none' }}><button className="btn-ghost" style={{ padding:'7px 14px', borderRadius:8, fontSize:13 }}>Wiki</button></Link>
                )}
                <SignInButton mode="modal"><button className="btn-ghost" style={{ padding: isMobile ? '8px 12px' : '9px 18px', borderRadius:8, fontSize: isMobile ? 12 : 14 }}>Log in</button></SignInButton>
                <SignUpButton mode="modal"><button className="btn-cta" style={{ padding: isMobile ? '8px 14px' : '9px 22px', borderRadius:8, fontSize: isMobile ? 12 : 14, whiteSpace:'nowrap' }}>{isMobile ? 'Start free' : 'Start free →'}</button></SignUpButton>
              </>
            )}
          </div>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:1 }}>

        {/* ── HERO ── */}
        <section style={{ textAlign:'center', padding: isMobile ? '56px 18px 56px' : '100px 24px 80px', maxWidth:820, margin:'0 auto' }}>
          <HeroWaveform />

          {/* Badge */}
          <div className="hero-item" style={{ display:'flex', justifyContent:'center', marginBottom:28, animationDelay:'80ms' }}>
            <div className="beginners-badge sf-mono" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 18px', fontSize:12, color:C }}>
              ✦ No DJ experience needed
            </div>
          </div>

          <h1 className="sf-display hero-item" style={{ fontSize:'clamp(52px,10vw,120px)', lineHeight:0.92, margin:'0 0 22px', letterSpacing:1, animationDelay:'160ms' }}>
            <span style={{ color:'#e8e8f0' }}>FORGE</span><br />
            <span className="hero-grad">PROFESSIONAL SETS</span>
          </h1>

          <p className="hero-item" style={{ fontSize:20, color:'#9a9ab8', maxWidth:560, margin:'0 auto 18px', lineHeight:1.75, animationDelay:'260ms' }}>
            AI-curated <TypewriterGenre /> sets — real tracks, matched BPM, perfect harmonic mixing, built in about 60 seconds. No music theory. No equipment. No experience.
          </p>
          <p className="hero-item" style={{ fontSize:15, color:'#5a5a7a', maxWidth:520, margin:'0 auto 30px', lineHeight:1.6, animationDelay:'340ms' }}>
            Perfect for beginners, producers planning sets, and anyone who loves music.
          </p>

          <div className="hero-item" style={{ display:'flex', justifyContent:'center', marginBottom:18, animationDelay:'420ms' }}>
            <a href="#tools" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8, fontSize:13, color:'#6a6a8a', border:'1px solid #1a1a2e', borderRadius:999, padding:'8px 16px', transition:'border-color .2s,color .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=C; (e.currentTarget as HTMLElement).style.color=C }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='#1a1a2e'; (e.currentTarget as HTMLElement).style.color='#6a6a8a' }}>
              Plus an Analyser, Mix &amp; Mashup Lab, and Night Planner ↓
            </a>
          </div>

          <div className="hero-item" style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', animationDelay:'500ms' }}>
            {isSignedIn ? (
              <Link href="/app"><button className="btn-cta" style={{ padding:'17px 40px', borderRadius:12, fontSize:17, fontWeight:700 }}>Open SetForge →</button></Link>
            ) : (
              <SignUpButton mode="modal"><button className="btn-cta" style={{ padding:'17px 40px', borderRadius:12, fontSize:17, fontWeight:700 }}>Start free — no card needed →</button></SignUpButton>
            )}
            <a href="#how-it-works" style={{ textDecoration:'none' }}>
              <button className="btn-ghost" style={{ padding:'17px 34px', borderRadius:12, fontSize:16 }}>See how it works</button>
            </a>
          </div>
          <p className="hero-item" style={{ marginTop:22, fontSize:13, color:'#3a3a58', animationDelay:'580ms' }}>Free plan available · 7-day Pro trial · Cancel anytime</p>
        </section>

        {/* ── STATS ── */}
        <Reveal>
          <section style={{ padding:'0 24px 72px' }}>
            <div style={{ maxWidth:820, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14 }}>
              {[
                { raw:'60', suffix:'s', label:'to generate your first set', numeric:true },
                { raw:'71', suffix:'',  label:'genres to choose from',       numeric:true },
                { raw:'0',  suffix:'',  label:'experience needed',            numeric:true },
                { raw:'',   suffix:'Free', label:'forever plan available',   numeric:false },
              ].map((s, i) => (
                <div key={i} className="stat-card" style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:'24px 18px', textAlign:'center', backdropFilter:'blur(8px)' }}>
                  <div className="sf-display" style={{ fontSize:52, letterSpacing:1, color:C, lineHeight:1 }}>
                    {s.numeric ? <CountUp target={parseInt(s.raw)} suffix={s.suffix} /> : s.suffix}
                  </div>
                  <div style={{ fontSize:13, color:'#6a6a8a', marginTop:6, lineHeight:1.4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── BEGINNERS CALLOUT ── */}
        <Reveal delay={100}>
          <section style={{ padding:'0 24px 72px', maxWidth:940, margin:'0 auto' }}>
            <div style={{ background:'linear-gradient(135deg,#0e0e1c,#0a0a14)', border:'1px solid #1f1f38', borderRadius:22, padding:'52px 44px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, background:`radial-gradient(circle,${C}10,transparent 70%)`, filter:'blur(40px)', pointerEvents:'none' }} />
              <div style={{ position:'absolute', bottom:-60, left:-60, width:280, height:280, background:`radial-gradient(circle,${M}0e,transparent 70%)`, filter:'blur(40px)', pointerEvents:'none' }} />
              <div style={{ position:'relative' }}>
                <div style={{ fontSize:12, color:C, fontWeight:700, letterSpacing:3, marginBottom:14, textTransform:'uppercase' }}>✦ Made for beginners</div>
                <h2 style={{ fontSize:'clamp(24px,4vw,38px)', fontWeight:800, margin:'0 0 16px', lineHeight:1.2, letterSpacing:'-0.02em' }}>
                  You don&apos;t need to know anything<br />about DJing to start.
                </h2>
                <p style={{ fontSize:16, color:'#8a8aaa', maxWidth:600, lineHeight:1.8, marginBottom:32 }}>
                  Most DJ tools assume you already have a tagged library, know your music theory, and have years behind the decks. SetForge doesn&apos;t assume any of that — tell it the vibe you&apos;re going for and it builds the whole set around it. Already run Rekordbox, Serato, or Traktor? Export your finished set straight into it with one click, no extra work either way.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:12 }}>
                  {['No library to import','No music theory knowledge','No DJ software required','No experience necessary'].map(text => (
                    <div key={text} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#c8c8e0', background:'rgba(0,240,255,.04)', border:'1px solid #1a1a2e', borderRadius:10, padding:'11px 14px' }}>
                      <span style={{ color:C, fontSize:16, flexShrink:0 }}>✓</span>{text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── TOOLS ── */}
        <Reveal>
          <section id="tools" style={{ padding:'0 24px 72px', maxWidth:1120, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <div style={{ fontSize:12, color:M, fontWeight:700, letterSpacing:3, marginBottom:14, textTransform:'uppercase' }}>✦ Four tools, one platform</div>
              <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, margin:'0 0 12px', letterSpacing:'-0.02em' }}>Everything from your first set to a full night</h2>
              <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:560, margin:'0 auto', lineHeight:1.7 }}>
                Build a set, grade one, test a transition, or plan a whole night — four tools that cover the job end to end.
              </p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:18 }}>
              {TOOLS.map(tool => (
                <div key={tool.name} className="tool-card" style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:20, padding:32, display:'flex', flexDirection:'column' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
                    <div style={{ fontSize:32, lineHeight:1 }}>{tool.icon}</div>
                    <div>
                      <div style={{ fontSize:19, fontWeight:800, color:'#e8e8f0' }}>{tool.name}</div>
                      <div style={{ fontSize:11, color:C, fontWeight:700, letterSpacing:.5, marginTop:2 }}>{tool.tag}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#e8e8f0', marginBottom:6, lineHeight:1.4 }}>{tool.title}</div>
                  <div style={{ fontSize:13, color:M, marginBottom:12, fontWeight:600 }}>{tool.plain}</div>
                  <p style={{ fontSize:14, color:'#8a8aa6', lineHeight:1.75, marginBottom:18, flex:1 }}>{tool.desc}</p>
                  <div style={{ marginBottom:18 }}><tool.preview /></div>
                  {isSignedIn ? (
                    <Link href={tool.href} style={{ textDecoration:'none' }}>
                      <button className="btn-ghost" style={{ width:'100%', padding:'11px 0', borderRadius:10, fontSize:14, fontWeight:700 }}>Try {tool.name} →</button>
                    </Link>
                  ) : (
                    <SignUpButton mode="modal">
                      <button className="btn-ghost" style={{ width:'100%', padding:'11px 0', borderRadius:10, fontSize:14, fontWeight:700 }}>Try {tool.name} →</button>
                    </SignUpButton>
                  )}
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── HOW IT WORKS ── */}
        <Reveal>
          <section id="how-it-works" style={{ padding:'0 24px 72px', maxWidth:1040, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, margin:'0 0 12px', letterSpacing:'-0.02em' }}>How Forge works</h2>
              <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:420, margin:'0 auto' }}>Three steps from blank page to a ready-to-play set.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
              {[
                { n:'1', color:M, title:'Tell it your vibe', desc:'Pick a genre (or describe your own in plain English), choose your crowd, set the mood.', tag:'Takes 30 seconds' },
                { n:'2', color:C, title:'AI builds your set', desc:'SetForge picks real tracks, orders them for harmonic flow, shapes the energy, and writes transition notes.', tag:'Ready in ~20 seconds' },
                { n:'3', color:M, title:'Tweak and take it', desc:"Swap tracks, drag to reorder, lock favourites. Copy, export, or share your finished set.", tag:'Your set, your way' },
              ].map((step) => (
                <div key={step.n} style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:18, padding:34, position:'relative', overflow:'hidden', transition:'transform .2s,box-shadow .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow=`0 16px 50px rgba(0,0,0,.3)` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>
                  <div style={{ position:'absolute', top:-24, right:-12, fontFamily:"'Bebas Neue',sans-serif", fontSize:140, color:step.color, opacity:0.05, lineHeight:1, pointerEvents:'none', userSelect:'none' }}>{step.n}</div>
                  <div style={{ position:'relative' }}>
                    <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:40, height:40, borderRadius:999, background:`${step.color}20`, border:`1.5px solid ${step.color}55`, fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:step.color, marginBottom:18 }}>{step.n}</div>
                    <h3 style={{ fontSize:20, fontWeight:700, margin:'0 0 10px', color:'#e8e8f0' }}>{step.title}</h3>
                    <p style={{ fontSize:14, color:'#6a6a8a', lineHeight:1.75, margin:'0 0 18px' }}>{step.desc}</p>
                    <div style={{ fontSize:12, color:step.color, fontWeight:600, background:`${step.color}12`, borderRadius:999, padding:'5px 14px', display:'inline-block', border:`1px solid ${step.color}33` }}>{step.tag}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── EXAMPLE GALLERY ── */}
        <Reveal delay={50}>
          <ExampleGallery />
        </Reveal>

        {/* ── FEATURES ── */}
        <Reveal>
          <section style={{ padding:'0 24px 72px', maxWidth:1120, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, margin:'0 0 12px', letterSpacing:'-0.02em' }}>What happens when you hit generate</h2>
              <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:480, margin:'0 auto' }}>Professional DJ tools, explained in plain English.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(310px,1fr))', gap:18 }}>
              {FEATURES.map(f => (
                <div key={f.title} className="feature-card" style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:18, padding:30, backdropFilter:'blur(8px)' }}>
                  <div className="feature-icon" style={{ fontSize:36, marginBottom:16 }}>{f.icon}</div>
                  <div style={{ fontSize:17, fontWeight:700, marginBottom:6, color:'#e8e8f0' }}>{f.title}</div>
                  <div style={{ fontSize:13, color:C, marginBottom:10, fontWeight:600 }}>{f.plain}</div>
                  <div style={{ fontSize:14, color:'#6a6a8a', lineHeight:1.75 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── WORKFLOW FEATURES ── */}
        <Reveal>
          <section style={{ padding:'0 24px 72px', maxWidth:1120, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, margin:'0 0 12px', letterSpacing:'-0.02em' }}>Built to fit a real DJ&apos;s workflow</h2>
              <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:480, margin:'0 auto' }}>The details that matter once you&apos;re using SetForge regularly.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(310px,1fr))', gap:18 }}>
              {WORKFLOW_FEATURES.map((f, i) => (
                <div key={f.title} className="feature-card" style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:18, padding:30, backdropFilter:'blur(8px)' }}>
                  <div className="feature-icon" style={{ fontSize:36, marginBottom:16 }}>{f.icon}</div>
                  <div style={{ fontSize:17, fontWeight:700, marginBottom:6, color:'#e8e8f0' }}>{f.title}</div>
                  <div style={{ fontSize:13, color: i % 2 === 0 ? M : C, marginBottom:10, fontWeight:600 }}>{f.plain}</div>
                  <div style={{ fontSize:14, color:'#6a6a8a', lineHeight:1.75 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── FAQ ── */}
        <Reveal>
          <section style={{ padding:'0 24px 72px', maxWidth:800, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:44 }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, margin:'0 0 12px', letterSpacing:'-0.02em' }}>Questions beginners always ask</h2>
              <p style={{ fontSize:16, color:'#6a6a8a' }}>No jargon. Just honest answers.</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {FAQS.map((faq, i) => (
                <div key={i} className="faq-row" onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ background:'#0a0a14', borderRadius:i===0?'16px 16px 0 0':i===FAQS.length-1?'0 0 16px 16px':'0', border:'1px solid #1a1a2e', borderTop:i===0?undefined:'none', overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'22px 26px', gap:16 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:'#e8e8f0', lineHeight:1.4 }}>{faq.q}</div>
                    <div style={{ fontSize:22, color:openFaq===i?C:'#3a3a58', transition:'transform .3s,color .2s', transform:openFaq===i?'rotate(45deg)':'none', flexShrink:0, lineHeight:1 }}>+</div>
                  </div>
                  <div className="faq-answer" style={{ maxHeight:openFaq===i?400:0, opacity:openFaq===i?1:0 }}>
                    <div style={{ padding:'0 26px 22px', fontSize:15, color:'#9a9ab8', lineHeight:1.8 }}>{faq.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── PRICING ── */}
        <Reveal>
          <section id="pricing" style={{ padding:'0 24px 72px', maxWidth:1040, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, margin:'0 0 12px', letterSpacing:'-0.02em' }}>Simple pricing</h2>
              <p style={{ fontSize:16, color:'#6a6a8a' }}>Start free forever. Upgrade when you&apos;re ready.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:22 }}>
              {TIERS.map(tier => (
                <div key={tier.name} className={`tier-card ${tier.highlight ? 'pro-pulse' : ''}`}
                  style={{ background:'#0a0a14', border:`1.5px solid ${tier.highlight ? M : '#1a1a2e'}`, borderRadius:20, padding:34, position:'relative' }}>
                  {tier.badge && (
                    <div style={{ position:'absolute', top:-13, left:'50%', transform:'translateX(-50%)', background:`linear-gradient(90deg,${M},${C})`, color:'#06060c', fontSize:11, padding:'5px 18px', borderRadius:999, fontWeight:800, whiteSpace:'nowrap', letterSpacing:.5 }}>{tier.badge}</div>
                  )}
                  <div style={{ fontSize:20, fontWeight:800, color:tier.color, marginBottom:4 }}>{tier.name}</div>
                  <div style={{ fontSize:13, color:'#6a6a8a', marginBottom:22 }}>{tier.desc}</div>
                  <div style={{ marginBottom:26, display:'flex', alignItems:'baseline', gap:6 }}>
                    <span style={{ fontSize:58, fontWeight:800, color:'#e8e8f0', letterSpacing:'-0.03em', lineHeight:1 }}>{tier.price}</span>
                    <span style={{ fontSize:14, color:'#6a6a8a' }}>{tier.period}</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
                    {tier.perks.map(p => (
                      <div key={p} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:14, color:'#c8c8e0' }}>
                        <span style={{ color:tier.color, flexShrink:0, marginTop:2, fontWeight:700 }}>✓</span>{p}
                      </div>
                    ))}
                  </div>
                  {isSignedIn ? (
                    tier.name === 'Free' ? (
                      <Link href="/app" style={{ textDecoration:'none' }}>
                        <button className="btn-ghost" style={{ width:'100%', padding:'14px 0', borderRadius:12, fontSize:15, fontWeight:700 }}>Open SetForge →</button>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(tier.name.toLowerCase())}
                        disabled={upgrading !== null}
                        className={tier.highlight ? 'btn-cta' : 'btn-ghost'}
                        style={{ width:'100%', padding:'14px 0', borderRadius:12, fontSize:15, fontWeight:700, opacity: upgrading ? .7 : 1 }}
                      >
                        {upgrading === tier.name.toLowerCase() ? 'Opening checkout…' : tier.cta}
                      </button>
                    )
                  ) : (
                    <SignUpButton mode="modal">
                      <button className={tier.highlight ? 'btn-cta' : 'btn-ghost'} style={{ width:'100%', padding:'14px 0', borderRadius:12, fontSize:15, fontWeight:700 }}>{tier.cta}</button>
                    </SignUpButton>
                  )}
                </div>
              ))}
            </div>
            <p style={{ textAlign:'center', fontSize:13, color:'#3a3a58', marginTop:24 }}>Pro and Team include a 7-day free trial. Free plan never expires.</p>
          </section>
        </Reveal>

        {/* ── BOTTOM CTA ── */}
        <Reveal delay={50}>
          <section style={{ padding:'0 24px 100px', textAlign:'center' }}>
            <div style={{ maxWidth:620, margin:'0 auto', background:'linear-gradient(135deg,#0e0e1c,#0a0a14)', border:'1px solid #1f1f38', borderRadius:26, padding:'60px 44px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 50% 110%,${C}0e,transparent 65%)`, pointerEvents:'none' }} />
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 50% -10%,${M}0a,transparent 60%)`, pointerEvents:'none' }} />
              <div style={{ position:'relative' }}>
                <div className="float" style={{ fontSize:40, marginBottom:16, lineHeight:1, display:'inline-block' }}>🚀</div>
                <div style={{ fontSize:12, color:C, fontWeight:700, letterSpacing:3, marginBottom:16, textTransform:'uppercase' }}>✦ Free forever plan</div>
                <h2 style={{ fontSize:'clamp(28px,5vw,44px)', fontWeight:800, margin:'0 0 16px', lineHeight:1.2, letterSpacing:'-0.02em' }}>Ready to build your first set?</h2>
                <p style={{ fontSize:16, color:'#6a6a8a', marginBottom:36, lineHeight:1.7 }}>
                  Real tracks, real key matching, ready in about a minute. Start free — no credit card, no time limit.
                </p>
                <SignUpButton mode="modal">
                  <button className="btn-cta" style={{ padding:'18px 52px', borderRadius:14, fontSize:17, fontWeight:800 }}>Start free — no card needed →</button>
                </SignUpButton>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop:'1px solid #16162a', padding:'36px 24px', textAlign:'center' }}>
          <div style={{ fontSize:28, letterSpacing:2, marginBottom:8 }}>
            <span className="logo-c">SET</span><span className="logo-m">FORGE</span>
          </div>
          <p style={{ fontSize:13, color:'#3a3a58', letterSpacing:.5 }}>
            © {new Date().getFullYear()} SetForge · AI-powered DJ set creation for everyone
          </p>
          <div style={{ display:'flex', justifyContent:'center', gap:16, marginTop:8 }}>
            <Link href="/wiki" style={{ fontSize:12, color:'#6a6a8a', textDecoration:'underline' }}>DJ Wiki</Link>
            <Link href="/feedback" style={{ fontSize:12, color:'#6a6a8a', textDecoration:'underline' }}>Share feedback</Link>
          </div>
        </footer>

      </div>
    </div>
  )
}
