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
    id: 'salt-air-bass',
    title: 'Salt Air Bass',
    summary: 'A sun-soaked bass house cruise that rolls from gritty low-end into euphoric, vocal-driven peaks.',
    genre: 'Bass House', crowd: 'Beach Club / Daytime', arc: 'Slow Build',
    tracks: [
      { n:1, artist:'Destructo',        title:'Dare You',             bpm:124, key:'10B', energy:4, transition:'Open on the groove, let the low-end settle in' },
      { n:2, artist:'Valentino Khan',   title:'Deep Down Low',        bpm:126, key:'4A',  energy:5, transition:'Key change blend, ride the bass stab into the switch' },
      { n:3, artist:"Chris Lorenzo",    title:"California Dreamin'",  bpm:128, key:'11B', energy:6, transition:'Quick cut on the groove, push the tempo up' },
      { n:4, artist:'Fisher',           title:'Losing It',            bpm:125, key:'10B', energy:7, transition:'Long blend through the breakdown, swap on the drop' },
      { n:5, artist:'Fisher',           title:'Stop It',              bpm:124, key:'4B',  energy:8, transition:'Filter sweep into the vocal hook' },
      { n:6, artist:'Gorgon City',      title:'Ready For Your Love (feat. MNEK)', bpm:124, key:'4A', energy:9, transition:'Slam it in on the vocal — crowd sings along' },
      { n:7, artist:'CamelPhat & Cristoph', title:'Breathe (feat. Jem Cooke)', bpm:125, key:'8A', energy:9, transition:'Closer — ride the euphoric outro' },
    ],
  },
  {
    id: 'salt-air-sunrise',
    title: 'Salt Air Sunrise',
    summary: 'A slow-burning coastal journey that eases in with sun-soaked grooves and tropical textures before steadily igniting into peak-hour heat by the final drop.',
    genre: 'Tropical / Progressive House', crowd: 'Beach Club / Sunrise', arc: 'Slow Build',
    tracks: [
      { n:1, artist:'Kygo',             title:'Firestone (feat. Conrad Sewell)', bpm:110, key:'8B', energy:3, transition:"Let the piano outro breathe, low-pass filter rising, blend quietly on the 64-bar mark" },
      { n:2, artist:'Robin Schulz',     title:'Sugar (feat. Francesco Yates)', bpm:115, key:'9A', energy:4, transition:'Strip to drums and bass on the breakdown, bring the next bassline in before the drop' },
      { n:3, artist:'Kygo',             title:'Stole the Show (feat. Parson James)', bpm:120, key:'7B', energy:5, transition:'Loop the 4-bar breakdown, bring the next kick underneath, crossfade on the downbeat' },
      { n:4, artist:'Disclosure',       title:'Latch (feat. Sam Smith)', bpm:124, key:'9A', energy:6, transition:'Ride the vocal hook, reverb throw on the last word, filter sweep into the next intro' },
      { n:5, artist:'Fisher',           title:'Losing It',            bpm:130, key:'10A', energy:7, transition:'Slam the filter shut on the breakdown, swap kicks hard on the drop' },
      { n:6, artist:'Duke Dumont',      title:'I Got U (feat. Jax Jones)', bpm:124, key:'12A', energy:8, transition:'Loop the stripped kick-hat outro, drop the bassline underneath, release on the vocal hook' },
      { n:7, artist:'Swedish House Mafia', title:"Don't You Worry Child (feat. John Martin)", bpm:128, key:'8A', energy:9, transition:'Blend over 32 bars, strip to a single synth stab, release the final chorus with reverb and delay wash — lights-up sendoff' },
    ],
  },
  {
    id: 'love-on-the-floor',
    title: 'Love On The Floor',
    summary: 'Opens at peak-floor R&B energy with radio anthems and steadily unwinds through slow jams to an intimate, romantic close.',
    genre: 'R&B / Slow Jams', crowd: 'Wedding / Late Night', arc: 'Wind Down',
    tracks: [
      { n:1, artist:'Beyoncé',          title:'Crazy In Love',        bpm:99,  key:'7A',  energy:8, transition:'Ride the brass hit loop into the outro, low-pass the horns and blend the kick into the next track on the 4-bar break' },
      { n:2, artist:'Usher',            title:'Yeah!',                bpm:105, key:'10B', energy:8, transition:'Layer the vocal chant over the breakdown, swap kick on the 2-bar drop fill' },
      { n:3, artist:'Nelly',            title:'Hot in Herre',         bpm:107, key:'10A', energy:9, transition:"Match the 107 BPM outro into the next track's intro with a slight tempo nudge, modest harmonic step keeps the energy locked in" },
      { n:4, artist:'Mark Ronson',      title:'Uptown Funk (feat. Bruno Mars)', bpm:115, key:'8B', energy:8, transition:"Ride the breakdown a cappella, bring the next groove in underneath, swap full mix on the chorus hit" },
      { n:5, artist:'Robin Thicke',     title:'Blurred Lines (feat. T.I. & Pharrell)', bpm:120, key:'9B', energy:7, transition:'Low-pass the drums in the final chorus, echo out the vocal and let the next warm piano creep in over 8 bars' },
      { n:6, artist:'John Legend',      title:'All of Me',            bpm:120, key:'4B',  energy:4, transition:"Blend piano intros at equal volume, soft filter fade strips back the mids to let the next track's warmth fill the space" },
      { n:7, artist:'Alicia Keys',      title:"If I Ain't Got You",   bpm:118, key:'9B',  energy:2, transition:'Closer — let the piano ring out, fade the room lights down with it' },
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
            <button className="btn-cta sf-mono" style={{ padding:'14px 32px', borderRadius:10, fontSize:13 }}>
              ⚡ FORGE YOUR OWN
            </button>
          </a>
        </div>
      </div>
    </section>
  )
}