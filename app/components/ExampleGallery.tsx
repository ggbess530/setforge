// ▸ Place at: app/components/ExampleGallery.tsx
// ▸ Then import and add <ExampleGallery /> to app/page.tsx between
//   the "How it works" section and the Features section.

'use client'

import { useState } from 'react'

const C = '#00f0ff'
const M = '#ff1e8a'
const CAM_HUES = [0,30,60,90,120,150,180,210,240,270,300,330]

type Track = { n:number; artist:string; title:string; bpm:number; key:string; energy:number; transition:string }
type ExampleSet = {
  id:      string
  title:   string
  summary: string
  genre:   string
  crowd:   string
  arc:     string
  tracks:  Track[]
}

// ── Pre-generated example sets ────────────────────────────────
const EXAMPLES: ExampleSet[] = [
  {
    id: 'midnight-circuit',
    title: 'Midnight Circuit',
    summary: 'A slow-burning tech house journey that builds from hypnotic grooves into peak-time pressure.',
    genre: 'Tech House', crowd: 'Club Peak Hour', arc: 'Slow Build',
    tracks: [
      { n:1, artist:'Cloonee',          title:'Sun Goes Down',        bpm:124, key:'7A',  energy:4, transition:'Open with the rolling bassline, let it breathe for 2 minutes' },
      { n:2, artist:'Fisher',           title:'Losing It',            bpm:125, key:'7A',  energy:5, transition:'Beatmatch on the breakdown, swap basslines at the drop' },
      { n:3, artist:'Chris Lake',       title:'Turn Off The Lights',  bpm:125, key:'8A',  energy:6, transition:'Filter sweep into the vocal hook' },
      { n:4, artist:'Dom Dolla',        title:'San Frandisco',        bpm:126, key:'8A',  energy:7, transition:'Quick cut on the kick, ride the energy up' },
      { n:5, artist:'John Summit',      title:'Deep End',             bpm:126, key:'9A',  energy:8, transition:'Long blend through the melodic break' },
      { n:6, artist:'Eli Brown',        title:'Believe',              bpm:127, key:'9A',  energy:9, transition:'Slam it in on the one — peak time has arrived' },
    ],
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour',
    summary: 'Sun-drenched afro house for a rooftop crowd — warm, organic, and endlessly groovy.',
    genre: 'Afro House', crowd: 'Rooftop / Lounge', arc: 'Wave (up & down)',
    tracks: [
      { n:1, artist:'Keinemusik',       title:'Muye',                 bpm:120, key:'5A',  energy:4, transition:'Set the tone — let the percussion carry the first 3 minutes' },
      { n:2, artist:'Black Coffee',     title:'Drive (feat. Delilah Montagu)', bpm:121, key:'5A', energy:5, transition:'Blend on the vocal, hold both tracks for 32 bars' },
      { n:3, artist:'&ME',              title:'The Rapture Pt.II',    bpm:122, key:'6A',  energy:7, transition:'Ride the synth swell into the drop' },
      { n:4, artist:'Adam Port',        title:'Place Of Gold',        bpm:121, key:'6A',  energy:6, transition:'Ease back down — let the groove breathe' },
      { n:5, artist:'Themba',           title:'Who Is Themba?',       bpm:122, key:'7A',  energy:7, transition:'Percussion-led transition, swap on the tom fill' },
      { n:6, artist:'Culoe De Song',    title:'Webaba',               bpm:121, key:'7A',  energy:5, transition:'Close the wave gently — sunset outro' },
    ],
  },
  {
    id: 'voltage-spike',
    title: 'Voltage Spike',
    summary: 'Relentless peak-time techno engineered for a festival main stage — no breaks, no mercy.',
    genre: 'Peak Time Techno', crowd: 'Festival Main Stage', arc: 'Peak Time Energy',
    tracks: [
      { n:1, artist:'Charlotte de Witte', title:'Doppler',            bpm:135, key:'10A', energy:7, transition:'Hit hard from the first kick — this crowd is ready' },
      { n:2, artist:'Amelie Lens',      title:'Higher',               bpm:136, key:'10A', energy:8, transition:'Quick 16-bar blend on the hats' },
      { n:3, artist:'I Hate Models',    title:'Daydream',             bpm:138, key:'11A', energy:9, transition:'Let the melody cut through, slam on the drop' },
      { n:4, artist:'Sara Landry',      title:'Hellfire',             bpm:140, key:'11A', energy:10, transition:'Full send — maximum pressure' },
      { n:5, artist:'Trym',             title:'Tekno Kids',           bpm:142, key:'12A', energy:10, transition:'Keep the ceiling — crowd is locked in' },
      { n:6, artist:'999999999',        title:'X0000000X',            bpm:140, key:'12A', energy:9, transition:'Closer — leave them screaming for one more' },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────
export default function ExampleGallery() {
  const [active, setActive] = useState(0)
  const ex = EXAMPLES[active]

  return (
    <section style={{ padding:'60px 24px', maxWidth:1000, margin:'0 auto' }}>
      <h2 className="sf-display" style={{ textAlign:'center', fontSize:48, letterSpacing:2, marginBottom:12, color:'#e8e8f0' }}>
        SEE IT IN ACTION
      </h2>
      <p className="sf-mono" style={{ textAlign:'center', color:'#6a6a8a', fontSize:12, letterSpacing:2, marginBottom:40 }}>
        REAL SETS FORGED BY THE AI — PICK A VIBE
      </p>

      {/* tab selector */}
      <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:32, flexWrap:'wrap' }}>
        {EXAMPLES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(i)}
            className="sf-mono"
            style={{
              padding:'10px 20px', borderRadius:999, fontSize:12, cursor:'pointer',
              background: i===active ? `linear-gradient(100deg,${M}22,${C}22)` : 'transparent',
              border: `1px solid ${i===active ? C : '#23233a'}`,
              color: i===active ? C : '#8a8aa8',
              transition:'.2s',
              boxShadow: i===active ? `0 0 16px ${C}33` : 'none',
            }}
          >
            {s.genre}
          </button>
        ))}
      </div>

      {/* set card */}
      <div style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:16, padding:28, position:'relative', overflow:'hidden' }}>
        {/* glow accent */}
        <div style={{ position:'absolute', top:-100, right:-100, width:300, height:300, background:`radial-gradient(circle,${M}15,transparent 70%)`, filter:'blur(30px)', pointerEvents:'none' }} />

        {/* header */}
        <div style={{ marginBottom:20, position:'relative' }}>
          <h3 className="sf-display" style={{ fontSize:34, margin:0, letterSpacing:1, color:C, textShadow:`0 0 16px ${C}60` }}>
            {ex.title}
          </h3>
          <p style={{ fontSize:13, color:'#9a9ab8', margin:'6px 0 10px', maxWidth:520 }}>{ex.summary}</p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {[ex.genre, ex.crowd, ex.arc].map(tag => (
              <span key={tag} className="sf-mono" style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 10px' }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* energy bar */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:44, background:'#06060c', border:'1px solid #16162a', borderRadius:10, padding:'6px 10px', marginBottom:18 }}>
          {ex.tracks.map((t,i) => (
            <div key={i} style={{ flex:1, height:`${(t.energy/10)*100}%`, minHeight:3, background:`linear-gradient(180deg,${M},${C})`, borderRadius:2, opacity:.85 }} />
          ))}
        </div>

        {/* tracks */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, position:'relative' }}>
          {ex.tracks.map(t => {
            const m   = t.key.match(/^(\d+)([AB])$/)
            const hue = m ? CAM_HUES[parseInt(m[1])-1] : 0
            return (
              <div key={t.n} style={{ display:'grid', gridTemplateColumns:'30px 1fr auto', gap:12, alignItems:'center', background:'#06060c', border:'1px solid #14142a', borderRadius:8, padding:'10px 14px' }}>
                <div className="sf-display" style={{ fontSize:20, color:M, textShadow:`0 0 8px ${M}60` }}>{String(t.n).padStart(2,'0')}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#e8e8f0' }}>{t.title}</div>
                  <div style={{ fontSize:11, color:'#8a8aa8' }}>{t.artist}</div>
                </div>
                <div className="sf-mono" style={{ display:'flex', gap:10, alignItems:'center', fontSize:11 }}>
                  <span style={{ color:C }}>{t.bpm}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:`hsl(${hue},85%,58%)`, boxShadow:`0 0 5px hsl(${hue},85%,58%)` }} />
                    <span style={{ color:'#e8e8f0' }}>{t.key}</span>
                  </span>
                  <span style={{ color:'#5a5a78' }}>E{t.energy}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign:'center', marginTop:24, position:'relative' }}>
          <a href="#pricing" style={{ textDecoration:'none' }}>
            <button className="btn-primary sf-mono" style={{ padding:'14px 32px', borderRadius:10, fontSize:13 }}>
              ⚡ FORGE YOUR OWN
            </button>
          </a>
        </div>
      </div>
    </section>
  )
}