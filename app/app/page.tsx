// ▸ Replace: app/page.tsx

'use client'

import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useState } from 'react'
import ExampleGallery from './components/ExampleGallery'

const C = '#00f0ff'
const M = '#ff1e8a'

// ── Beginner-friendly feature descriptions ─────────────────
const FEATURES = [
  {
    icon: '🎵',
    title: 'Picks the perfect tracks for you',
    plain: 'No more hours of searching for songs that go together.',
    desc:  'Our AI listens to your vibe — genre, mood, crowd — and selects real tracks that actually flow together. Like having a DJ friend who knows everything.',
  },
  {
    icon: '🔗',
    title: 'Songs that sound amazing back-to-back',
    plain: 'Ever noticed how some songs clash when mixed? This stops that.',
    desc:  'SetForge automatically orders tracks so the musical keys are compatible. Every transition sounds intentional — even if you\'ve never mixed before.',
  },
  {
    icon: '🔄',
    title: 'Don\'t like a song? Swap it instantly',
    plain: 'You\'re always in control.',
    desc:  'If one track doesn\'t feel right, hit swap. The AI replaces it with something that fits the same energy and sound — without breaking the flow.',
  },
  {
    icon: '📈',
    title: 'Sets that build to a peak',
    plain: 'Great DJ sets tell a story. Yours will too.',
    desc:  'Choose how your set should feel — a slow build to peak energy, a consistent vibe, or a cool-down. SetForge shapes every track selection around that journey.',
  },
  {
    icon: '☁️',
    title: 'Your sets saved forever',
    plain: 'Come back any time and pick up where you left off.',
    desc:  'Every set you create is saved to your personal library in the cloud. Rename them, load them, share them — they\'re yours forever.',
  },
  {
    icon: '📤',
    title: 'Ready to take to your DJ software',
    plain: 'Works with Rekordbox, Serato, Traktor, and more.',
    desc:  'Export any set as a formatted list you can take straight into your DJ software — or just copy and paste it anywhere you need it.',
  },
]

// ── FAQ ────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Do I need to be a DJ to use SetForge?',
    a: 'Not at all. SetForge was built with beginners in mind. If you love music and want to put together a great playlist or DJ set — even your first one ever — SetForge will do the hard work for you. No experience needed.',
  },
  {
    q: 'What is BPM and why does it matter?',
    a: 'BPM stands for Beats Per Minute — it\'s basically how fast a song is. Most club and dance music sits between 120–130 BPM. When songs in a DJ set have similar BPMs, the mix sounds smooth instead of jarring. SetForge handles all of this automatically.',
  },
  {
    q: 'What is harmonic mixing? Do I need to understand it?',
    a: 'Harmonic mixing means choosing songs that are in compatible musical keys — so they sound good played back-to-back. Professional DJs spend years learning this. SetForge does it instantly for every track in your set, so you get pro-quality transitions without knowing any music theory.',
  },
  {
    q: 'Do I need any DJ equipment or software?',
    a: 'No equipment needed to use SetForge — it works in any web browser on any device. If you do have DJ software like Rekordbox or Serato, you can export your set directly to it. But you can also just use SetForge to plan your set and find great music.',
  },
  {
    q: 'Will the AI suggest real songs I can actually find?',
    a: 'Yes. SetForge suggests real, well-known tracks that exist on Beatport, Spotify, and major platforms. Every track card has direct links so you can preview and buy the songs instantly. Think of it as AI-powered music discovery.',
  },
  {
    q: 'What is an "energy arc" and which should I pick?',
    a: '"Energy arc" is just how your set builds and flows over time. "Slow Build" means starting mellow and getting more intense — great for warming up a crowd. "Peak Time" keeps energy high throughout. "Cool Down" works for the end of a night. "Wave" goes up and down. When in doubt, pick Slow Build — it\'s the most crowd-pleasing.',
  },
  {
    q: 'How is SetForge different from just making a Spotify playlist?',
    a: 'A Spotify playlist is just songs in a row. SetForge creates a DJ set — every track is chosen for its BPM, musical key, energy level, and how it flows into the next one. You also get detailed transition notes telling you exactly how to mix between tracks. It\'s the difference between a list and a performance.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — every new account gets a full 7-day free trial with complete Pro access. No credit card required to start. Try it, forge some sets, and see if you love it before paying anything.',
  },
]

// ── Stats ──────────────────────────────────────────────────
const STATS = [
  { n: '60s',  label: 'to generate your first set' },
  { n: '42',   label: 'genres to choose from' },
  { n: '0',    label: 'experience needed' },
  { n: '7',    label: 'day free trial' },
]

export default function LandingPage() {
  const { isSignedIn } = useAuth()
  const [openFaq, setOpenFaq] = useState<number|null>(null)

  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif", overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        .sf-mono    { font-family:'JetBrains Mono',monospace; }
        .sf-display { font-family:'Bebas Neue',sans-serif; }
        .glow-c { text-shadow:0 0 20px ${C}80; }
        .glow-m { text-shadow:0 0 20px ${M}80; }
        .btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:box-shadow .2s, transform .15s; }
        .btn-primary:hover { box-shadow:0 0 32px ${C}66,0 0 32px ${M}44; transform:translateY(-1px); }
        .btn-ghost { background:transparent; border:1.5px solid #2a2a42; color:#e8e8f0; cursor:pointer; font-family:'Inter',sans-serif; transition:border-color .2s,color .2s,transform .15s; }
        .btn-ghost:hover { border-color:${C}; color:${C}; transform:translateY(-1px); }
        .feature-card { transition:transform .2s,border-color .2s,box-shadow .2s; }
        .feature-card:hover { transform:translateY(-4px); border-color:#2a2a42!important; box-shadow:0 8px 40px rgba(0,0,0,.4); }
        .faq-row { cursor:pointer; transition:background .15s; }
        .faq-row:hover { background:#0d0d1a!important; }
        .stat-card { transition:transform .2s; }
        .stat-card:hover { transform:translateY(-3px); }
        .beginners-badge { background:linear-gradient(90deg,${M}22,${C}22); border:1px solid ${C}44; border-radius:999px; }
        * { box-sizing:border-box; }
        ::selection { background:${C}44; }
      `}</style>

      {/* fixed bg */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C}07 1px,transparent 1px),linear-gradient(90deg,${C}07 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 0%,black,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)', width:900, height:600, background:`radial-gradient(circle,${M}15,transparent 65%)`, filter:'blur(80px)', pointerEvents:'none', zIndex:0 }} />

      {/* ── NAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(16px)', background:'rgba(6,6,12,.85)', padding:'0 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
          <div className="sf-display" style={{ fontSize:30, letterSpacing:2 }}>
            <span className="glow-c" style={{ color:C }}>SET</span><span className="glow-m" style={{ color:M }}>FORGE</span>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {isSignedIn ? (
              <>
                <Link href="/app">
                  <button className="btn-primary" style={{ padding:'9px 22px', borderRadius:8, fontSize:14, fontWeight:600 }}>Open App →</button>
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="btn-ghost" style={{ padding:'9px 18px', borderRadius:8, fontSize:14 }}>Log in</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn-primary" style={{ padding:'9px 22px', borderRadius:8, fontSize:14, fontWeight:600 }}>Try free for 7 days →</button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:1 }}>

        {/* ── HERO ── */}
        <section style={{ textAlign:'center', padding:'90px 24px 70px', maxWidth:780, margin:'0 auto' }}>
          {/* beginner badge */}
          <div className="beginners-badge sf-mono" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', fontSize:12, color:C, marginBottom:28 }}>
            ✦ No DJ experience needed — seriously
          </div>

          <h1 style={{ fontSize:'clamp(38px,6vw,72px)', fontWeight:700, lineHeight:1.15, margin:'0 0 24px', letterSpacing:'-0.02em' }}>
            Build a professional DJ set<br />
            <span style={{ background:`linear-gradient(90deg,${M},${C})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              in about 60 seconds.
            </span>
          </h1>

          <p style={{ fontSize:19, color:'#9a9ab8', maxWidth:560, margin:'0 auto 16px', lineHeight:1.7, fontWeight:400 }}>
            Tell SetForge your vibe — genre, mood, how long your set is — and the AI builds you a complete, professionally structured tracklist. No music theory. No DJ software. No experience.
          </p>
          <p style={{ fontSize:15, color:'#6a6a8a', maxWidth:500, margin:'0 auto 44px', lineHeight:1.6 }}>
            Perfect for beginners learning to DJ, producers planning sets, and anyone who loves music.
          </p>

          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            {isSignedIn ? (
              <Link href="/app">
                <button className="btn-primary" style={{ padding:'16px 36px', borderRadius:10, fontSize:16, fontWeight:700 }}>Open SetForge →</button>
              </Link>
            ) : (
              <SignUpButton mode="modal">
                <button className="btn-primary" style={{ padding:'16px 36px', borderRadius:10, fontSize:16, fontWeight:700 }}>Start free — no card needed →</button>
              </SignUpButton>
            )}
            <a href="#how-it-works" style={{ textDecoration:'none' }}>
              <button className="btn-ghost" style={{ padding:'16px 32px', borderRadius:10, fontSize:15 }}>See how it works</button>
            </a>
          </div>

          <p style={{ marginTop:24, fontSize:13, color:'#4a4a66' }}>7-day free trial · No credit card · Cancel anytime</p>
        </section>

        {/* ── STATS BAR ── */}
        <section style={{ padding:'0 24px 60px' }}>
          <div style={{ maxWidth:800, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16 }}>
            {STATS.map(s => (
              <div key={s.n} className="stat-card" style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:14, padding:'24px 16px', textAlign:'center' }}>
                <div className="sf-display" style={{ fontSize:48, letterSpacing:1, color:C }} >{s.n}</div>
                <div style={{ fontSize:13, color:'#6a6a8a', marginTop:4, lineHeight:1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOR BEGINNERS CALLOUT ── */}
        <section style={{ padding:'20px 24px 60px', maxWidth:900, margin:'0 auto' }}>
          <div style={{ background:'linear-gradient(135deg,#0d0d1a,#0a0a14)', border:'1px solid #1f1f38', borderRadius:20, padding:'48px 40px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-60, right:-60, width:250, height:250, background:`radial-gradient(circle,${C}12,transparent 70%)`, filter:'blur(30px)', pointerEvents:'none' }} />
            <div style={{ position:'relative' }}>
              <div style={{ fontSize:13, color:C, fontWeight:600, letterSpacing:2, marginBottom:12, textTransform:'uppercase' }}>✦ Made for beginners</div>
              <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:700, margin:'0 0 16px', lineHeight:1.2 }}>
                You don't need to know anything about DJing to start.
              </h2>
              <p style={{ fontSize:16, color:'#9a9ab8', maxWidth:580, lineHeight:1.7, marginBottom:28 }}>
                Setflow, Rekordbox, Traktor — those tools assume you already have a massive music library and years of experience. SetForge assumes nothing. Just tell it what you like and it handles everything else: picking the songs, matching the tempo, making sure the transitions sound smooth.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
                {[
                  { icon:'✅', text:'No library to import' },
                  { icon:'✅', text:'No music theory knowledge' },
                  { icon:'✅', text:'No DJ software required' },
                  { icon:'✅', text:'No experience necessary' },
                ].map(item => (
                  <div key={item.text} style={{ display:'flex', alignItems:'center', gap:10, fontSize:15, color:'#c8c8e0' }}>
                    <span>{item.icon}</span>{item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" style={{ padding:'40px 24px 60px', maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:700, margin:'0 0 12px' }}>How it works</h2>
            <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:480, margin:'0 auto' }}>Three steps from blank page to ready-to-play set.</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
            {[
              {
                n:'1', color:M,
                title:'Tell it your vibe',
                desc:'Pick a genre (or describe your own), choose your crowd type, set the mood. Even something like "dark and hypnotic warehouse techno" works perfectly.',
                tag:'Takes 30 seconds',
              },
              {
                n:'2', color:C,
                title:'AI builds your set',
                desc:'SetForge picks real tracks, orders them so they flow together musically, shapes the energy across your set, and writes transition notes for each song.',
                tag:'Ready in ~20 seconds',
              },
              {
                n:'3', color:M,
                title:'Tweak and take it',
                desc:'Swap tracks you don\'t love, drag them into your preferred order, lock your favourites. Then copy, export, or share your finished set.',
                tag:'Your set, your way',
              },
            ].map(step => (
              <div key={step.n} style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:32, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-20, right:-10, fontFamily:"'Bebas Neue',sans-serif", fontSize:120, color:step.color, opacity:0.06, lineHeight:1, pointerEvents:'none', userSelect:'none' }}>{step.n}</div>
                <div style={{ position:'relative' }}>
                  <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:999, background:`${step.color}22`, border:`1px solid ${step.color}44`, fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:step.color, marginBottom:16 }}>{step.n}</div>
                  <h3 style={{ fontSize:19, fontWeight:700, margin:'0 0 10px' }}>{step.title}</h3>
                  <p style={{ fontSize:14, color:'#6a6a8a', lineHeight:1.7, margin:'0 0 16px' }}>{step.desc}</p>
                  <div style={{ fontSize:12, color:step.color, fontWeight:600, background:`${step.color}11`, borderRadius:999, padding:'4px 12px', display:'inline-block' }}>{step.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── EXAMPLE GALLERY ── */}
        <ExampleGallery />

        {/* ── FEATURES ── */}
        <section style={{ padding:'40px 24px 60px', maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:700, margin:'0 0 12px' }}>Everything you need to build great sets</h2>
            <p style={{ fontSize:16, color:'#6a6a8a', maxWidth:500, margin:'0 auto' }}>Professional DJ tools, explained in plain English.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(310px,1fr))', gap:18 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card" style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:28 }}>
                <div style={{ fontSize:32, marginBottom:14 }}>{f.icon}</div>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:6, color:'#e8e8f0' }}>{f.title}</div>
                <div style={{ fontSize:13, color:C, marginBottom:10, fontWeight:500 }}>{f.plain}</div>
                <div style={{ fontSize:14, color:'#6a6a8a', lineHeight:1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ padding:'40px 24px 60px', maxWidth:780, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:700, margin:'0 0 12px' }}>Questions beginners always ask</h2>
            <p style={{ fontSize:16, color:'#6a6a8a' }}>No jargon. Just honest answers.</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-row" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ background:'#0a0a14', borderRadius: i===0?'14px 14px 0 0':i===FAQS.length-1?'0 0 14px 14px':'0', border:'1px solid #1a1a2e', borderTop: i===0?undefined:'none', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', gap:16 }}>
                  <div style={{ fontSize:15, fontWeight:600, color:'#e8e8f0', lineHeight:1.4 }}>{faq.q}</div>
                  <div style={{ fontSize:20, color: openFaq===i ? C : '#4a4a66', transition:'transform .2s,color .2s', transform:openFaq===i?'rotate(45deg)':'none', flexShrink:0 }}>+</div>
                </div>
                {openFaq === i && (
                  <div style={{ padding:'0 24px 20px', fontSize:15, color:'#9a9ab8', lineHeight:1.75 }}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" style={{ padding:'40px 24px 60px', maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:700, margin:'0 0 12px' }}>Simple pricing</h2>
            <p style={{ fontSize:16, color:'#6a6a8a' }}>Start free. No credit card. Cancel whenever you want.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {[
              {
                name:'Starter', price:'$9', period:'/month', highlight:false,
                badge:null, color:C,
                desc:'Great for DJs learning the craft.',
                perks:['30 sets per month','Swap tracks as much as you want','Save & organise your sets','Export to DJ software'],
              },
              {
                name:'Pro', price:'$19', period:'/month', highlight:true,
                badge:'Most popular', color:M,
                desc:'For DJs who create sets regularly.',
                perks:['Unlimited sets','Unlimited track swaps','Cloud library','Export to DJ software','Priority generation'],
              },
              {
                name:'Agency', price:'$39', period:'/month', highlight:false,
                badge:null, color:C,
                desc:'For teams, agencies, and promoters.',
                perks:['Everything in Pro','Whole team access','Custom branding on exports','Early feature access'],
              },
            ].map(tier => (
              <div key={tier.name} style={{ background:'#0a0a14', border:`1.5px solid ${tier.highlight ? M : '#1a1a2e'}`, borderRadius:18, padding:32, position:'relative', boxShadow:tier.highlight?`0 0 50px ${M}18`:'none', transition:'transform .2s' }}>
                {tier.badge && (
                  <div style={{ position:'absolute', top:-13, left:'50%', transform:'translateX(-50%)', background:M, color:'#06060c', fontSize:11, padding:'4px 16px', borderRadius:999, fontWeight:700, whiteSpace:'nowrap' }}>{tier.badge}</div>
                )}
                <div style={{ fontSize:20, fontWeight:700, color:tier.color, marginBottom:4 }}>{tier.name}</div>
                <div style={{ fontSize:13, color:'#6a6a8a', marginBottom:20 }}>{tier.desc}</div>
                <div style={{ marginBottom:24 }}>
                  <span style={{ fontSize:52, fontWeight:700, color:'#e8e8f0', letterSpacing:'-0.02em' }}>{tier.price}</span>
                  <span style={{ fontSize:14, color:'#6a6a8a' }}>{tier.period}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
                  {tier.perks.map(p => (
                    <div key={p} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:14, color:'#c8c8e0' }}>
                      <span style={{ color:tier.color, flexShrink:0, marginTop:1 }}>✓</span>{p}
                    </div>
                  ))}
                </div>
                <SignUpButton mode="modal">
                  <button className={tier.highlight?'btn-primary':'btn-ghost'} style={{ width:'100%', padding:'14px 0', borderRadius:10, fontSize:15, fontWeight:600 }}>
                    Start 7-day free trial
                  </button>
                </SignUpButton>
              </div>
            ))}
          </div>
          <p style={{ textAlign:'center', fontSize:13, color:'#4a4a66', marginTop:24 }}>All plans include a 7-day free trial. No credit card required to start.</p>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section style={{ padding:'60px 24px 100px', textAlign:'center' }}>
          <div style={{ maxWidth:600, margin:'0 auto', background:'linear-gradient(135deg,#0d0d1a,#0a0a14)', border:'1px solid #1f1f38', borderRadius:24, padding:'56px 40px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 50% 100%,${C}0e,transparent 70%)`, pointerEvents:'none' }} />
            <div style={{ position:'relative' }}>
              <div style={{ fontSize:13, color:C, fontWeight:600, letterSpacing:2, marginBottom:16, textTransform:'uppercase' }}>✦ Free for 7 days</div>
              <h2 style={{ fontSize:'clamp(28px,5vw,44px)', fontWeight:700, margin:'0 0 16px', lineHeight:1.2 }}>
                Ready to build your first set?
              </h2>
              <p style={{ fontSize:16, color:'#6a6a8a', marginBottom:32, lineHeight:1.6 }}>
                Join DJs and music lovers already using SetForge. Your first set is one minute away.
              </p>
              <SignUpButton mode="modal">
                <button className="btn-primary" style={{ padding:'18px 48px', borderRadius:12, fontSize:16, fontWeight:700 }}>Start free — no card needed →</button>
              </SignUpButton>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop:'1px solid #16162a', padding:'32px 24px', textAlign:'center' }}>
          <div className="sf-display" style={{ fontSize:26, letterSpacing:2, marginBottom:8 }}>
            <span style={{ color:C }}>SET</span><span style={{ color:M }}>FORGE</span>
          </div>
          <p style={{ fontSize:13, color:'#4a4a66', letterSpacing:.5 }}>
            © {new Date().getFullYear()} SetForge · AI-powered DJ set creation for everyone
          </p>
        </footer>

      </div>
    </div>
  )
}