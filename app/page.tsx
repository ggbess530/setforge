// ▸ Replace: app/page.tsx

'use client'
import ExampleGallery from './components/ExampleGallery'
import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

const C = '#00f0ff'
const M = '#ff1e8a'

const FEATURES = [
  { icon: '⚡', title: 'AI-Powered Curation',  desc: 'Claude selects real tracks matched to your genre, crowd, BPM range, and energy arc — not random shuffles.' },
  { icon: '♪',  title: 'Harmonic Key Matching', desc: 'Camelot wheel logic orders every track so transitions are always harmonically compatible.' },
  { icon: '⟳',  title: 'Hot-Swap Any Track',    desc: 'Hate one pick? Swap it instantly. Claude replaces it while keeping the BPM and key flow intact.' },
  { icon: '◈',  title: 'Set Library',            desc: 'Save unlimited sets, rename them, load them back any time. Your library lives in the cloud.' },
  { icon: '↓',  title: 'Export Ready',           desc: 'Export any set as a .txt blueprint to take straight into Rekordbox, Serato, or Traktor.' },
  { icon: '🎛', title: '42 Genres',              desc: 'From Tech House to Amapiano to Hard Techno — every major genre and sub-genre covered.' },
]

const TIERS = [
  {
    name:  'Starter',
    price: '$9',
    color: C,
    perks: ['30 set generations / month', 'Unlimited hot-swaps', 'Set library (save & load)', 'Export to .txt'],
  },
  {
    name:  'Pro',
    price: '$19',
    color: M,
    badge: 'Most Popular',
    perks: ['Unlimited generations', 'Unlimited hot-swaps', 'Set library', 'Export to .txt', 'Priority generation speed'],
  },
  {
    name:  'Agency',
    price: '$39',
    color: C,
    perks: ['Everything in Pro', 'Unlimited sets for your whole team', 'Custom branding on exports', 'Early access to new features'],
  },
]

export default function LandingPage() {
  const { isSignedIn } = useAuth()

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>

      <style>{`
       
        .sf-mono    { font-family: 'JetBrains Mono', monospace; }
        .sf-display { font-family: 'Bebas Neue', sans-serif; }
        .glow-c { text-shadow: 0 0 20px ${C}80; }
        .glow-m { text-shadow: 0 0 20px ${M}80; }
        .btn-primary { background: linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; letter-spacing:2px; transition:box-shadow .2s; }
        .btn-primary:hover { box-shadow:0 0 32px ${C}66, 0 0 32px ${M}44; }
        .btn-ghost { background:transparent; border:1px solid #23233a; color:#e8e8f0; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:border-color .2s, color .2s; }
        .btn-ghost:hover { border-color:${C}; color:${C}; }
        .feature-card:hover { border-color:#23233a !important; transform:translateY(-2px); }
        .tier-card:hover { transform:translateY(-4px); }
        * { box-sizing:border-box; }
      `}</style>

      {/* bg */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C}0a 1px,transparent 1px),linear-gradient(90deg,${C}0a 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 0%,black,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)', width:800, height:500, background:`radial-gradient(circle,${M}18,transparent 65%)`, filter:'blur(60px)', pointerEvents:'none', zIndex:0 }} />

      {/* nav */}
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(12px)', background:'#06060ccc', padding:'0 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
          <div className="sf-display" style={{ fontSize:32, letterSpacing:2 }}>
            <span className="glow-c" style={{ color:C }}>SET</span><span className="glow-m" style={{ color:M }}>FORGE</span>
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            {isSignedIn ? (
              <>
                <Link href="/app">
                  <button className="btn-primary sf-mono" style={{ padding:'8px 20px', borderRadius:8, fontSize:12 }}>OPEN APP</button>
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="btn-ghost sf-mono" style={{ padding:'8px 18px', borderRadius:8, fontSize:12 }}>LOG IN</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn-primary sf-mono" style={{ padding:'8px 20px', borderRadius:8, fontSize:12 }}>START FREE</button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:1 }}>

        {/* hero */}
        <section style={{ textAlign:'center', padding:'100px 24px 80px' }}>
          <div className="sf-mono" style={{ fontSize:11, letterSpacing:6, color:M, marginBottom:16 }}>PERSONALIZED SET CREATION</div>
          <h1 className="sf-display" style={{ fontSize:'clamp(72px,12vw,140px)', lineHeight:0.9, margin:'0 0 32px', letterSpacing:2 }}>
            <span className="glow-c" style={{ color:C }}>SET</span><br />
            <span className="glow-m" style={{ color:M }}>FORGE</span>
          </h1>
          <p style={{ fontSize:20, color:'#9a9ab8', maxWidth:560, margin:'0 auto 48px', lineHeight:1.6 }}>
            AI-curated DJ sets in seconds. Drop in your genre, BPM range, and vibe — walk away with a full tracklist, Camelot key map, and transition notes.
          </p>
          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
            {isSignedIn ? (
              <Link href="/app">
                <button className="btn-primary sf-mono" style={{ padding:'16px 36px', borderRadius:10, fontSize:14 }}>⚡ OPEN SETFORGE</button>
              </Link>
            ) : (
              <SignUpButton mode="modal">
                <button className="btn-primary sf-mono" style={{ padding:'16px 36px', borderRadius:10, fontSize:14 }}>⚡ FORGE YOUR FIRST SET</button>
              </SignUpButton>
            )}
            <a href="#pricing" style={{ textDecoration:'none' }}>
              <button className="btn-ghost sf-mono" style={{ padding:'16px 36px', borderRadius:10, fontSize:14 }}>SEE PRICING</button>
            </a>
          </div>
          <p className="sf-mono" style={{ marginTop:40, fontSize:11, color:'#4a4a66', letterSpacing:2 }}>TRUSTED BY DJS · PRODUCERS · PROMOTERS</p>
        </section>

        {/* how it works */}
        <section style={{ padding:'60px 24px', maxWidth:900, margin:'0 auto' }}>
          <h2 className="sf-display" style={{ textAlign:'center', fontSize:48, letterSpacing:2, marginBottom:48, color:C }}>HOW IT WORKS</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:2 }}>
            {[
              { n:'01', title:'Set your parameters', desc:'Choose genre, crowd type, energy arc, BPM range, vibe, and reference artists.' },
              { n:'02', title:'Claude curates',       desc:'AI selects real tracks with matching keys, BPMs, and energy levels shaped to your arc.' },
              { n:'03', title:'Refine and export',    desc:"Hot-swap any track you don't like, save to your library, export to .txt for your DJ software." },
            ].map((step) => (
              <div key={step.n} style={{ background:'#0a0a14', border:'1px solid #16162a', padding:32 }}>
                <div className="sf-display" style={{ fontSize:64, color:M, opacity:0.3, lineHeight:1, marginBottom:12 }}>{step.n}</div>
                <div className="sf-mono" style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>{step.title}</div>
                <div style={{ fontSize:14, color:'#6a6a8a', lineHeight:1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </section>
	<ExampleGallery />
        {/* features */}
        <section style={{ padding:'60px 24px', maxWidth:1100, margin:'0 auto' }}>
          <h2 className="sf-display" style={{ textAlign:'center', fontSize:48, letterSpacing:2, marginBottom:48 }}>EVERYTHING YOU NEED</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card" style={{ background:'#0a0a14', border:'1px solid #16162a', borderRadius:12, padding:24, transition:'border-color .2s, transform .2s' }}>
                <div style={{ fontSize:28, marginBottom:12 }}>{f.icon}</div>
                <div className="sf-mono" style={{ fontSize:13, fontWeight:700, marginBottom:8, color:C }}>{f.title}</div>
                <div style={{ fontSize:14, color:'#6a6a8a', lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* pricing */}
        <section id="pricing" style={{ padding:'80px 24px', maxWidth:1000, margin:'0 auto' }}>
          <h2 className="sf-display" style={{ textAlign:'center', fontSize:48, letterSpacing:2, marginBottom:12 }}>PRICING</h2>
          <p className="sf-mono" style={{ textAlign:'center', color:'#6a6a8a', fontSize:12, letterSpacing:2, marginBottom:48 }}>NO CONTRACTS · CANCEL ANYTIME</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {TIERS.map((tier) => (
              <div key={tier.name} className="tier-card" style={{ background:'#0a0a14', border:`1px solid ${tier.badge ? M : '#16162a'}`, borderRadius:16, padding:32, position:'relative', transition:'transform .2s', boxShadow:tier.badge ? `0 0 40px ${M}22` : 'none' }}>
                {tier.badge && (
                  <div className="sf-mono" style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:M, color:'#06060c', fontSize:10, padding:'3px 14px', borderRadius:999, fontWeight:700, whiteSpace:'nowrap' }}>
                    {tier.badge}
                  </div>
                )}
                <div className="sf-display" style={{ fontSize:28, letterSpacing:1, color:tier.color, marginBottom:4 }}>{tier.name}</div>
                <div style={{ marginBottom:24 }}>
                  <span className="sf-display" style={{ fontSize:56 }}>{tier.price}</span>
                  <span className="sf-mono" style={{ fontSize:12, color:'#6a6a8a' }}> / month</span>
                </div>
                <ul style={{ listStyle:'none', padding:0, margin:'0 0 28px', display:'flex', flexDirection:'column', gap:10 }}>
                  {tier.perks.map((p) => (
                    <li key={p} className="sf-mono" style={{ fontSize:12, color:'#9a9ab8', display:'flex', gap:8, alignItems:'flex-start' }}>
                      <span style={{ color:tier.color, flexShrink:0 }}>✓</span>{p}
                    </li>
                  ))}
                </ul>
                <SignUpButton mode="modal">
                  <button className={tier.badge ? 'btn-primary' : 'btn-ghost'} style={{ width:'100%', padding:'13px 0', borderRadius:8, fontSize:12 }}>
                    GET STARTED
                  </button>
                </SignUpButton>
              </div>
            ))}
          </div>
        </section>

        {/* bottom CTA */}
        <section style={{ textAlign:'center', padding:'80px 24px 120px' }}>
          <h2 className="sf-display" style={{ fontSize:64, letterSpacing:2, margin:'0 0 20px' }}>
            <span style={{ color:C }} className="glow-c">READY TO</span><br />
            <span style={{ color:M }} className="glow-m">FORGE YOUR SET?</span>
          </h2>
          <p style={{ color:'#6a6a8a', marginBottom:40, fontSize:16 }}>Join DJs already using SetForge to build better sets, faster.</p>
          <SignUpButton mode="modal">
            <button className="btn-primary sf-mono" style={{ padding:'18px 48px', borderRadius:10, fontSize:15 }}>⚡ START FOR FREE</button>
          </SignUpButton>
        </section>

        {/* footer */}
        <footer style={{ borderTop:'1px solid #16162a', padding:'24px', textAlign:'center' }}>
          <div className="sf-display" style={{ fontSize:24, letterSpacing:2, marginBottom:8 }}>
            <span style={{ color:C }}>SET</span><span style={{ color:M }}>FORGE</span>
          </div>
          <p className="sf-mono" style={{ fontSize:11, color:'#4a4a66', letterSpacing:1 }}>
            © {new Date().getFullYear()} SETFORGE · AI-POWERED DJ SET CREATION
          </p>
        </footer>

      </div>
    </div>
  )
}
