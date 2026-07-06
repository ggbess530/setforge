// ▸ Create folder: app/components/
// ▸ Place at:      app/components/OnboardingWizard.tsx

'use client'

import { useState } from 'react'

const C = '#00f0ff'
const M = '#ff1e8a'

export type WizardResult = {
  genre:     string
  crowd:     string
  arc:       string
  vibe:      string
  refArtist: string
  minutes:   number
  mode:      'time'
}

interface Props {
  onComplete: (result: WizardResult) => void
  onSkip:     () => void
}

const WIZARD_GENRES = [
  { value:'Tech House',              emoji:'🏭', name:'Tech House',    desc:'Dark, driving beats. Underground clubs.' },
  { value:'House',                   emoji:'🏠', name:'House',         desc:'Groovy and soulful. Good vibes all night.' },
  { value:'Hip Hop',                 emoji:'🎤', name:'Hip Hop',        desc:'Beats, bars, and culture.' },
  { value:'Afrobeats',               emoji:'🌍', name:'Afrobeats',      desc:'Infectious African rhythms. Made to dance.' },
  { value:'Drum & Bass',             emoji:'⚡', name:'Drum & Bass',    desc:'Fast and energetic. Pure adrenaline.' },
  { value:'Techno',                  emoji:'🖤', name:'Techno',         desc:'Raw, industrial, late night.' },
  { value:'Melodic Techno',          emoji:'🌌', name:'Melodic Techno', desc:'Emotional, hypnotic, atmospheric.' },
  { value:'Disco / Funk',            emoji:'🕺', name:'Disco / Funk',   desc:'Feel-good, retro, timeless.' },
  { value:'Open Format / Multi-Genre', emoji:'🎲', name:'Open Format', desc:'Mix of everything. No rules.' },
]

const WIZARD_VIBES = [
  { arc:'Slow Build',        emoji:'🌊', name:'Slow build',  desc:'Start mellow, peak hard. The classic DJ journey.' },
  { arc:'Peak Time Energy',  emoji:'🔥', name:'Full power',  desc:'Maximum energy all the way through.' },
  { arc:'Cool Down',         emoji:'🌙', name:'Chill out',   desc:'Smooth and easy. Perfect for a late-night wind-down.' },
  { arc:'Wave (up & down)',  emoji:'〰️', name:'Wave',        desc:'Energy rises and falls. Keeps the crowd guessing.' },
]

const WIZARD_CROWDS = [
  { value:'Club Peak Hour',      emoji:'🏢', name:'Club / Nightclub', desc:'Dark room, loud speakers, everyone dancing.' },
  { value:'House Party',         emoji:'🏠', name:'House party',      desc:'Friends, living room, great energy.' },
  { value:'Rooftop / Lounge',    emoji:'🌇', name:'Rooftop / Lounge', desc:'Daytime vibes, relaxed crowd.' },
  { value:'Warm-Up Set',         emoji:'🌅', name:'Warm-up set',      desc:'Before the main act. Build the mood slowly.' },
  { value:'Festival Main Stage', emoji:'🎪', name:'Festival',          desc:'Big crowd, big energy, big moments.' },
  { value:'Wedding',             emoji:'💍', name:'Wedding / Event',  desc:'Mixed crowd, all ages, crowd-pleasing picks.' },
]

export default function OnboardingWizard({ onComplete, onSkip }: Props) {
  const [step,      setStep]      = useState(0)
  const [genre,     setGenre]     = useState('')
  const [arc,       setArc]       = useState('')
  const [crowd,     setCrowd]     = useState('')
  const [minutes,   setMinutes]   = useState(60)
  const [refArtist, setRefArtist] = useState('')

  const TOTAL = 5

  function next() { setStep(s => s + 1) }
  function back() { setStep(s => s - 1) }

  function finish() {
    try { localStorage.setItem('sf_onboarded', 'true') } catch {}
    onComplete({
      genre:     genre     || 'Tech House',
      crowd:     crowd     || 'Club Peak Hour',
      arc:       arc       || 'Slow Build',
      vibe:      '',
      refArtist: refArtist.trim(),
      minutes,
      mode:      'time',
    })
  }

  function skipAndComplete() {
    setRefArtist('')
    finish()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(6,6,12,.96)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(10px)' }}>
      <style>{`
        .wiz-card { cursor:pointer; transition:background .15s, border-color .15s, transform .12s; }
        .wiz-card:hover { transform:translateY(-2px); }
        .wiz-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; border:none; cursor:pointer; font-weight:700; font-family:'Inter',system-ui,sans-serif; transition:box-shadow .2s; }
        .wiz-btn-primary:hover { box-shadow:0 0 24px ${C}55, 0 0 24px ${M}33; }
        .wiz-input { background:#0d0d18; border:1px solid #1f1f38; color:#e8e8f0; font-family:'Inter',system-ui,sans-serif; font-size:14px; padding:12px 16px; border-radius:10px; outline:none; width:100%; box-sizing:border-box; transition:border-color .2s; }
        .wiz-input:focus { border-color:${C}; }
      `}</style>

      <div style={{ background:'#0a0a14', border:'1px solid #1f1f38', borderRadius:22, padding:'40px 36px', maxWidth:560, width:'100%', position:'relative', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Skip button */}
        <button onClick={onSkip} style={{ position:'absolute', top:16, right:20, background:'none', border:'none', color:'#4a4a66', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
          Skip intro →
        </button>

        {/* Progress bar */}
        {step > 0 && (
          <div style={{ marginBottom:28 }}>
            <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:8 }}>
              {Array.from({ length:TOTAL }, (_, i) => (
                <div key={i} style={{ height:6, borderRadius:999, background: i < step ? `linear-gradient(90deg,${M},${C})` : '#1f1f38', transition:'all .3s', flex: i < step ? 2 : 1 }} />
              ))}
            </div>
            <div style={{ textAlign:'center', fontSize:11, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', letterSpacing:1 }}>
              STEP {step} OF {TOTAL}
            </div>
          </div>
        )}

        {/* ── STEP 0: Welcome ── */}
        {step === 0 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🎧</div>
            <h2 style={{ fontSize:26, fontWeight:700, margin:'0 0 12px', fontFamily:"'Inter',sans-serif", lineHeight:1.2 }}>
              Let&apos;s build your first DJ set
            </h2>
            <p style={{ fontSize:16, color:'#9a9ab8', lineHeight:1.7, margin:'0 0 28px' }}>
              We&apos;ll ask you 5 quick questions, then our AI builds you a complete, ready-to-play set. Takes about 2 minutes.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28, textAlign:'left' }}>
              {[
                { icon:'🎵', text:'Real songs you can actually find and buy' },
                { icon:'🔗', text:'Every track flows smoothly into the next' },
                { icon:'⚡', text:'No DJ experience needed whatsoever' },
              ].map(item => (
                <div key={item.text} style={{ display:'flex', alignItems:'center', gap:12, fontSize:14, color:'#c8c8e0', background:'#0d0d18', borderRadius:12, padding:'12px 16px' }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>{item.text}
                </div>
              ))}
            </div>
            <button onClick={next} className="wiz-btn-primary" style={{ padding:'15px 0', borderRadius:12, fontSize:16, width:'100%' }}>
              Let&apos;s go →
            </button>
          </div>
        )}

        {/* ── STEP 1: Genre ── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 6px', fontFamily:"'Inter',sans-serif" }}>What kind of music do you love? 🎵</h2>
            <p style={{ fontSize:14, color:'#6a6a8a', margin:'0 0 20px', lineHeight:1.5 }}>Pick the style that gets you moving. Tap to select — we&apos;ll move to the next step automatically.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
              {WIZARD_GENRES.map(g => (
                <div key={g.value} className="wiz-card" onClick={() => { setGenre(g.value); setTimeout(next, 180) }}
                  style={{ background: genre===g.value ? `linear-gradient(135deg,${M}22,${C}22)` : '#0d0d18', border:`1px solid ${genre===g.value ? C : '#1f1f38'}`, borderRadius:12, padding:'12px 14px' }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{g.emoji}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e8e8f0', marginBottom:2 }}>{g.name}</div>
                  <div style={{ fontSize:11, color:'#6a6a8a', lineHeight:1.4 }}>{g.desc}</div>
                </div>
              ))}
            </div>
            <Back onClick={back} />
          </div>
        )}

        {/* ── STEP 2: Energy / Vibe ── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 6px', fontFamily:"'Inter',sans-serif" }}>How should the energy feel? ⚡</h2>
            <p style={{ fontSize:14, color:'#6a6a8a', margin:'0 0 20px', lineHeight:1.5 }}>Think about the mood you want to create for your crowd.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {WIZARD_VIBES.map(v => (
                <div key={v.arc} className="wiz-card" onClick={() => { setArc(v.arc); setTimeout(next, 180) }}
                  style={{ background: arc===v.arc ? `linear-gradient(135deg,${M}22,${C}22)` : '#0d0d18', border:`1px solid ${arc===v.arc ? C : '#1f1f38'}`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ fontSize:28, flexShrink:0 }}>{v.emoji}</div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:600, color:'#e8e8f0', marginBottom:2 }}>{v.name}</div>
                    <div style={{ fontSize:12, color:'#6a6a8a' }}>{v.desc}</div>
                  </div>
                  {arc===v.arc && <div style={{ marginLeft:'auto', color:C, fontSize:18, flexShrink:0 }}>✓</div>}
                </div>
              ))}
            </div>
            <Back onClick={back} />
          </div>
        )}

        {/* ── STEP 3: Crowd ── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 6px', fontFamily:"'Inter',sans-serif" }}>Where are you playing? 📍</h2>
            <p style={{ fontSize:14, color:'#6a6a8a', margin:'0 0 20px', lineHeight:1.5 }}>This helps SetForge choose the right energy level and song selection for your audience.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
              {WIZARD_CROWDS.map(c => (
                <div key={c.value} className="wiz-card" onClick={() => { setCrowd(c.value); setTimeout(next, 180) }}
                  style={{ background: crowd===c.value ? `linear-gradient(135deg,${M}22,${C}22)` : '#0d0d18', border:`1px solid ${crowd===c.value ? C : '#1f1f38'}`, borderRadius:12, padding:'12px 14px' }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{c.emoji}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e8e8f0', marginBottom:2 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:'#6a6a8a', lineHeight:1.4 }}>{c.desc}</div>
                </div>
              ))}
            </div>
            <Back onClick={back} />
          </div>
        )}

        {/* ── STEP 4: Length ── */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 6px', fontFamily:"'Inter',sans-serif" }}>How long is your set? ⏱️</h2>
            <p style={{ fontSize:14, color:'#6a6a8a', margin:'0 0 24px', lineHeight:1.5 }}>Most beginners start with 30–60 minutes — that&apos;s 8–15 tracks. Perfect for a first set.</p>
            <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:14, padding:'24px 20px', marginBottom:20 }}>
              <input type="range" min={30} max={180} step={15} value={minutes} onChange={e => setMinutes(+e.target.value)}
                style={{ width:'100%', accentColor:C, marginBottom:16, height:10, cursor:'pointer' }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:16 }}>
                <div>
                  <span style={{ fontSize:44, fontWeight:700, color:C, fontFamily:"'Bebas Neue',sans-serif" }}>{minutes}</span>
                  <span style={{ fontSize:16, color:'#6a6a8a', marginLeft:8 }}>minutes</span>
                </div>
                <div style={{ fontSize:13, color:'#6a6a8a' }}>≈ {Math.round(minutes/4.5)} tracks</div>
              </div>
              {/* Quick presets */}
              <div style={{ display:'flex', gap:8 }}>
                {[{m:30,label:'30m\nShort'},{m:60,label:'60m\n1 hour'},{m:90,label:'90m\nLong'},{m:120,label:'2h\nMarathon'}].map(p => (
                  <div key={p.m} onClick={() => setMinutes(p.m)}
                    style={{ flex:1, textAlign:'center', padding:'8px 4px', borderRadius:8, background: minutes===p.m ? `${C}22` : '#0d0d18', border:`1px solid ${minutes===p.m ? C : '#1f1f38'}`, fontSize:11, color: minutes===p.m ? C : '#6a6a8a', cursor:'pointer', transition:'.15s', lineHeight:1.4, whiteSpace:'pre' }}>
                    {p.label}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={next} className="wiz-btn-primary" style={{ padding:'13px 0', borderRadius:10, fontSize:15, width:'100%', marginBottom:10 }}>
              Continue →
            </button>
            <Back onClick={back} />
          </div>
        )}

        {/* ── STEP 5: Reference artist (optional) ── */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 6px', fontFamily:"'Inter',sans-serif" }}>
              Any artists you love?
              <span style={{ fontSize:13, color:'#4a4a66', fontWeight:400, marginLeft:10 }}>Optional</span>
            </h2>
            <p style={{ fontSize:14, color:'#6a6a8a', margin:'0 0 20px', lineHeight:1.5 }}>
              SetForge will pick tracks that sit naturally alongside them. Type a few names, or just skip this.
            </p>
            <input
              className="wiz-input"
              value={refArtist}
              onChange={e => setRefArtist(e.target.value)}
              placeholder="e.g. Fisher, Chris Lake, Drake, Beyoncé…"
              onKeyDown={e => e.key === 'Enter' && finish()}
              style={{ marginBottom:20 }}
              autoFocus
            />
            {/* Summary */}
            <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:12, padding:'14px 18px', marginBottom:20 }}>
              <div style={{ fontSize:11, color:'#4a4a66', letterSpacing:1, marginBottom:10, fontFamily:'JetBrains Mono,monospace' }}>YOUR SET</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {[genre, arc, crowd, `${minutes} min`].map(tag => (
                  <span key={tag} style={{ fontSize:12, color:'#9a9ab8', background:'#0d0d18', border:'1px solid #1f1f38', borderRadius:999, padding:'3px 10px' }}>{tag}</span>
                ))}
              </div>
            </div>
            <button onClick={finish} className="wiz-btn-primary" style={{ padding:'15px 0', borderRadius:12, fontSize:16, width:'100%', marginBottom:10 }}>
              ⚡ Build my first set!
            </button>
            <button onClick={skipAndComplete} style={{ background:'none', border:'none', color:'#6a6a8a', cursor:'pointer', fontSize:13, fontFamily:'inherit', width:'100%', padding:'8px 0' }}>
              Skip — build without artist reference
            </button>
            <Back onClick={back} />
          </div>
        )}

      </div>
    </div>
  )
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background:'none', border:'none', color:'#4a4a66', cursor:'pointer', fontSize:13, fontFamily:'inherit', padding:'6px 0', display:'block' }}>
      ← Back
    </button>
  )
}