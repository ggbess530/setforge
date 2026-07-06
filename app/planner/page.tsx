// ▸ Create: app/planner/page.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { calcBridge } from '@/lib/mix-utils'

const C = '#00f0ff', M = '#ff1e8a'

// ── Types ─────────────────────────────────────────────────────
export interface Slot {
  id:           string
  djName:       string
  genre:        string
  startTime:    string   // "22:00"
  duration:     number   // minutes
  targetEnergy: number   // 1-10
  crowd:        string
  vibe:         string
  bpmLow:       number
  bpmHigh:      number
  color:        string
  set?:         { title:string; tracks:{artist:string;title:string;bpm:number;key:string;energy:number;n:number;transition?:string}[] } | null
  generating?:  boolean
}

interface Night {
  id?:    string
  name:   string
  date:   string
  venue:  string
  slots:  Slot[]
}

const SLOT_COLORS = ['#00f0ff','#ff1e8a','#4ade80','#f59e0b','#a78bfa','#fb923c','#38bdf8','#f472b6']
const GENRES = ['Tech House','House','Deep House','Techno','Melodic Techno','Afro House','Drum & Bass','Trance','Hip Hop','Open Format']
const CROWDS = ['Club Peak Hour','Warm-Up','Festival','House Party','Rooftop','Wedding']

function newSlot(index: number, prevEnd: string): Slot {
  return {
    id:           crypto.randomUUID(),
    djName:       '',
    genre:        'Tech House',
    startTime:    prevEnd,
    duration:     60,
    targetEnergy: 7,
    crowd:        'Club Peak Hour',
    vibe:         '',
    bpmLow:       122,
    bpmHigh:      128,
    color:        SLOT_COLORS[index % SLOT_COLORS.length],
    set:          null,
  }
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
}

// ── Handoff badge ─────────────────────────────────────────────
function HandoffBadge({ s1, s2 }: { s1: Slot; s2: Slot }) {
  const t1 = s1.set?.tracks?.at(-1)
  const t2 = s2.set?.tracks?.[0]
  if (!t1 || !t2) {
    return (
      <div style={{ padding:'4px 10px', borderRadius:999, background:'#1a1a2e', fontSize:10, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>
        HANDOFF: Generate both sets to see
      </div>
    )
  }
  const bridge = calcBridge(t1, t2, t1.energy, t2.energy)
  const cfg = { perfect:'#4ade80', smooth:C, risky:'#f59e0b', clash:M }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', borderRadius:999, background:`${cfg[bridge.compatibility]}18`, border:`1px solid ${cfg[bridge.compatibility]}44`, fontSize:10, fontFamily:'JetBrains Mono,monospace', color:cfg[bridge.compatibility] }}>
      <span>⇄ HANDOFF: {bridge.compatibility.toUpperCase()}</span>
      <span style={{ color:'#6a6a8a' }}>{t1.key}→{t2.key} · {bridge.bpmDelta > 0 ? '+' : ''}{bridge.bpmDelta} BPM</span>
    </div>
  )
}

// ── Timeline slot card ────────────────────────────────────────
function SlotCard({ slot, index, onDelete, onGenerate, onSelect, selected, generating }: {
  slot: Slot; index: number
  onDelete: (id: string) => void
  onGenerate: (id: string) => void
  onSelect: (id: string) => void
  selected: boolean
  generating: boolean
}) {
  return (
    <div onClick={() => onSelect(slot.id)}
      style={{ background:'#0a0a14', border:`2px solid ${selected ? slot.color : '#1a1a2e'}`, borderRadius:14,
        padding:16, cursor:'pointer', transition:'.2s', boxShadow: selected ? `0 0 20px ${slot.color}33` : 'none',
        position:'relative', minWidth:260 }}>

      {/* Colour strip + time badge */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:slot.color, borderRadius:'12px 12px 0 0' }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginTop:8, marginBottom:12 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:slot.color, lineHeight:1 }}>
            {slot.djName || `DJ ${index + 1}`}
          </div>
          <div style={{ fontSize:10, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace' }}>
            {slot.startTime} · {slot.duration}min · E{slot.targetEnergy}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(slot.id) }}
          style={{ background:'transparent', border:'none', color:'#3a3a58', cursor:'pointer', fontSize:14, padding:'2px 6px' }}>✕</button>
      </div>

      {/* Genre + crowd */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        <span style={{ fontSize:10, color:'#9a9ab8', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 8px' }}>{slot.genre}</span>
        <span style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 8px' }}>{slot.bpmLow}–{slot.bpmHigh}</span>
      </div>

      {/* Set status */}
      {slot.set ? (
        <div style={{ background:'#06060c', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
          <div style={{ fontSize:11, color:slot.color, fontWeight:600, marginBottom:2 }}>{slot.set.title}</div>
          <div style={{ fontSize:10, color:'#6a6a8a' }}>{slot.set.tracks.length} tracks ready</div>
        </div>
      ) : (
        <div style={{ background:'#06060c', borderRadius:8, padding:'8px 10px', marginBottom:10, textAlign:'center' }}>
          <div style={{ fontSize:10, color:'#4a4a66' }}>No set generated yet</div>
        </div>
      )}

      <button
        onClick={e => { e.stopPropagation(); onGenerate(slot.id) }}
        disabled={generating}
        style={{ width:'100%', padding:'8px 0', borderRadius:8, border:'none', cursor:generating?'default':'pointer',
          background:generating?'#1a1a2e':`linear-gradient(100deg,${slot.color}88,${slot.color})`,
          color:generating?'#4a4a66':'#06060c', fontSize:11, fontWeight:700,
          fontFamily:'JetBrains Mono,monospace', transition:'.2s' }}>
        {generating ? 'GENERATING…' : slot.set ? '↻ REGENERATE' : '⚡ GENERATE SET'}
      </button>
    </div>
  )
}

// ── Slot editor panel ─────────────────────────────────────────
function SlotEditor({ slot, onUpdate }: { slot: Slot; onUpdate: (id: string, patch: Partial<Slot>) => void }) {
  const sfInput: React.CSSProperties = {
    background:'#06060c', border:'1px solid #1f1f33', color:'#e8e8f0',
    fontFamily:'JetBrains Mono,monospace', fontSize:12, padding:'8px 11px',
    borderRadius:8, width:'100%', outline:'none', boxSizing:'border-box',
  }
  const sfSelect: React.CSSProperties = { ...sfInput, cursor:'pointer' }
  const u = (patch: Partial<Slot>) => onUpdate(slot.id, patch)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:10, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:4 }}>SLOT SETTINGS</div>

      <div>
        <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>DJ / ARTIST NAME</div>
        <input style={sfInput} value={slot.djName} onChange={e => u({ djName: e.target.value })} placeholder="e.g. Garrett Bess" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>START TIME</div>
          <input style={sfInput} type="time" value={slot.startTime} onChange={e => u({ startTime: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>DURATION (min)</div>
          <input style={sfInput} type="number" value={slot.duration} onChange={e => u({ duration: parseInt(e.target.value) || 60 })} />
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>GENRE</div>
        <select style={sfSelect} value={slot.genre} onChange={e => u({ genre: e.target.value })}>
          {GENRES.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>CROWD</div>
        <select style={sfSelect} value={slot.crowd} onChange={e => u({ crowd: e.target.value })}>
          {CROWDS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>VIBE / MOOD <span style={{ color:'#3a3a58' }}>optional</span></div>
        <input style={sfInput} value={slot.vibe} onChange={e => u({ vibe: e.target.value })} placeholder="e.g. dark warehouse, summery rooftop…" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>BPM LOW</div>
          <input style={sfInput} type="number" value={slot.bpmLow} onChange={e => u({ bpmLow: parseInt(e.target.value) || 120 })} />
        </div>
        <div>
          <div style={{ fontSize:10, color:'#4a4a66', marginBottom:4 }}>BPM HIGH</div>
          <input style={sfInput} type="number" value={slot.bpmHigh} onChange={e => u({ bpmHigh: parseInt(e.target.value) || 128 })} />
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, color:'#4a4a66', marginBottom:6 }}>TARGET ENERGY: <span style={{ color:C }}>{slot.targetEnergy}/10</span></div>
        <input type="range" min={1} max={10} value={slot.targetEnergy} onChange={e => u({ targetEnergy: parseInt(e.target.value) })}
          style={{ width:'100%', accentColor:slot.color }} />
      </div>
      <div>
        <div style={{ fontSize:10, color:'#4a4a66', marginBottom:6 }}>SLOT COLOUR</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {SLOT_COLORS.map(col => (
            <div key={col} onClick={() => u({ color: col })}
              style={{ width:24, height:24, borderRadius:'50%', background:col, cursor:'pointer',
                border:`2px solid ${slot.color === col ? '#fff' : 'transparent'}`, transition:'.15s' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function PlannerPage() {
  const [night, setNight] = useState<Night>({
    name: 'Untitled Night', date: '', venue: '', slots: []
  })
  const [nightId,      setNightId]      = useState<string|undefined>()
  const [selectedId,   setSelectedId]   = useState<string|null>(null)
  const [generatingId, setGeneratingId] = useState<string|null>(null)
  const [saving,       setSaving]       = useState(false)
  const [savedFlash,   setSavedFlash]   = useState(false)
  const [nights,       setNights]       = useState<Night[]>([])
  const [showNights,   setShowNights]   = useState(false)
  const [dragging,     setDragging]     = useState<string|null>(null)
  const [dragOver,     setDragOver]     = useState<string|null>(null)
  const [exporting,    setExporting]    = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Mobile layout. Unlike app/page.tsx, the primary workspace here (add slot /
  // generate / timeline) lives in the RIGHT panel, so `mobileShowResults`
  // defaults to true (timeline visible). Selecting a slot or opening night
  // settings flips it to false (night meta / slot editor visible); loading a
  // saved night or generating a set flips it back to true.
  const [isMobile,          setIsMobile]          = useState(false)
  const [mobileShowResults, setMobileShowResults] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const selectedSlot = night.slots.find(s => s.id === selectedId) || null

  function updateSlot(id: string, patch: Partial<Slot>) {
    setNight(prev => ({ ...prev, slots: prev.slots.map(s => s.id === id ? { ...s, ...patch } : s) }))
  }

  function selectSlot(id: string) {
    setSelectedId(id)
    if (isMobile) setMobileShowResults(false)
  }

  function addSlot() {
    const last = night.slots.at(-1)
    const prevEnd = last ? addMinutes(last.startTime, last.duration) : '22:00'
    const slot = newSlot(night.slots.length, prevEnd)
    setNight(prev => ({ ...prev, slots: [...prev.slots, slot] }))
    selectSlot(slot.id)
  }

  function deleteSlot(id: string) {
    setNight(prev => ({ ...prev, slots: prev.slots.filter(s => s.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }

  // Drag reorder
  function onDragStart(id: string) { setDragging(id) }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOver(id) }
  function onDrop(id: string) {
    if (!dragging || dragging === id) { setDragging(null); setDragOver(null); return }
    setNight(prev => {
      const slots = [...prev.slots]
      const fromIdx = slots.findIndex(s => s.id === dragging)
      const toIdx   = slots.findIndex(s => s.id === id)
      const [moved] = slots.splice(fromIdx, 1)
      slots.splice(toIdx, 0, moved)
      return { ...prev, slots }
    })
    setDragging(null); setDragOver(null)
  }

  // Generate set for one slot
  async function generateSlot(id: string) {
    const idx  = night.slots.findIndex(s => s.id === id)
    const slot = night.slots[idx]
    if (!slot) return
    setGeneratingId(id)
    updateSlot(id, { generating: true })
    try {
      const res  = await fetch('/api/planner/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot,
          prevSlot: idx > 0 ? night.slots[idx - 1] : null,
          nextSlot: idx < night.slots.length - 1 ? night.slots[idx + 1] : null,
          includeMixingNotes: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        updateSlot(id, { set: data.set, generating: false })
        if (isMobile) setMobileShowResults(true)
      } else {
        updateSlot(id, { generating: false })
      }
    } catch {
      updateSlot(id, { generating: false })
    } finally {
      setGeneratingId(null)
    }
  }

  // Generate all slots sequentially
  async function generateAll() {
    for (const slot of night.slots) {
      if (!slot.set) await generateSlot(slot.id)
    }
  }

  // Save night
  async function saveNight() {
    setSaving(true)
    try {
      const res  = await fetch('/api/planner', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: nightId, ...night }),
      })
      const data = await res.json()
      if (res.ok) { setNightId(data.night.id); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000) }
    } catch {}
    finally { setSaving(false) }
  }

  // Load nights
  async function loadNights() {
    const res  = await fetch('/api/planner')
    const data = await res.json()
    if (res.ok) setNights(data.nights || [])
    setShowNights(true)
  }

  // Export runsheet
  async function exportRunsheet() {
    setExporting(true)
    const lines: string[] = [
      '╔══════════════════════════════════════╗',
      `║  ${night.name.toUpperCase().padEnd(36)}║`,
      `║  ${(night.date || 'Date TBD').padEnd(36)}║`,
      `║  ${(night.venue || 'Venue TBD').padEnd(36)}║`,
      '╚══════════════════════════════════════╝',
      '',
    ]
    night.slots.forEach((slot, i) => {
      lines.push(`── SLOT ${i + 1}: ${slot.djName || 'DJ'} ──────────────────────`)
      lines.push(`   Time: ${slot.startTime} · Duration: ${slot.duration} min`)
      lines.push(`   Genre: ${slot.genre} · BPM: ${slot.bpmLow}–${slot.bpmHigh}`)
      if (slot.set) {
        lines.push(`   Set: ${slot.set.title}`)
        lines.push('')
        slot.set.tracks.forEach(t => {
          lines.push(`   ${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title} [${t.bpm} BPM · ${t.key}]`)
          if (t.transition) lines.push(`       ↳ ${t.transition}`)
        })
      } else {
        lines.push('   ⚠ No set generated yet')
      }
      lines.push('')
    })
    lines.push('─'.repeat(40))
    lines.push('Generated with SetForge — setforge.online')

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${night.name.replace(/\s+/g,'_')}_runsheet.txt`,
    })
    a.click()
    setExporting(false)
  }

  // Night-wide stats
  const totalDuration = night.slots.reduce((s, slot) => s + slot.duration, 0)
  const slotsWithSets = night.slots.filter(s => s.set).length

  return (
    <div style={{ height: isMobile ? '100dvh' : '100vh', display:'flex', flexDirection:'column', background:'#06060c', color:'#e8e8f0', fontFamily:"'Inter',system-ui,sans-serif", overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        .sf-display { font-family:'Bebas Neue',sans-serif; }
        .btn-cta { background:linear-gradient(110deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:box-shadow .2s,transform .15s; }
        .btn-cta:hover { box-shadow:0 0 0 3px ${C}44; transform:translateY(-1px); }
        .btn-ghost { background:transparent; border:1.5px solid #2a2a42; color:#e8e8f0; cursor:pointer; font-family:'Inter',sans-serif; transition:border-color .2s,color .2s; }
        .btn-ghost:hover { border-color:${C}; color:${C}; }
        .slot-drag { transition:opacity .15s,transform .15s; }
        .slot-drag.dragging { opacity:.4; transform:scale(.97); }
        .slot-drag.dragover { outline:2px solid ${C}; outline-offset:2px; border-radius:14px; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; } ::-webkit-scrollbar-thumb { background:#1f1f33; border-radius:2px; }
      `}</style>

      {/* NAV */}
      <nav style={{ flexShrink:0, height:52, borderBottom:'1px solid #1a1a2e', backdropFilter:'blur(16px)', background:'rgba(6,6,12,.95)', padding: isMobile ? '0 10px' : '0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:50, overflowX:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 8 : 16, flexShrink:0 }}>
          <Link href="/" style={{ textDecoration:'none' }}>
            <div className="sf-display" style={{ fontSize: isMobile ? 20 : 24, letterSpacing:2 }}>
              <span style={{ color:C }}>SET</span><span style={{ color:M }}>FORGE</span>
            </div>
          </Link>
          {!isMobile && <div style={{ fontSize:11, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace' }}>/ NIGHT PLANNER</div>}
        </div>
        <div style={{ display:'flex', gap: isMobile ? 6 : 8, alignItems:'center', flexShrink:0 }}>
          <Link href="/app" style={{ textDecoration:'none' }}>
            <button className="btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 14px', borderRadius:7, fontSize:12, whiteSpace:'nowrap' }}>⚡{!isMobile && ' Forge'}</button>
          </Link>
          <Link href="/mix" style={{ textDecoration:'none' }}>
            <button className="btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 14px', borderRadius:7, fontSize:12, whiteSpace:'nowrap' }}>🎛️{!isMobile && ' Mix'}</button>
          </Link>
          <UserButton />
        </div>
      </nav>

      {/* SPLIT LAYOUT */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── LEFT: Night meta + slot editor ── */}
        <div style={{ width: isMobile ? '100%' : 300, flexShrink:0, borderRight: isMobile ? 'none' : '1px solid #1a1a2e', overflowY:'auto', padding:16, display: isMobile && mobileShowResults ? 'none' : 'flex', flexDirection:'column', gap:14 }}>

          {/* Mobile back bar */}
          {isMobile && (
            <div style={{ position:'sticky', top:-16, marginTop:-16, marginLeft:-16, marginRight:-16, marginBottom:2, zIndex:20, display:'flex', alignItems:'center', height:44, padding:'0 14px', background:'#06060cee', backdropFilter:'blur(12px)', borderBottom:'1px solid #1a1a2e' }}>
              <button onClick={() => setMobileShowResults(true)} className="btn-ghost" style={{ padding:'6px 12px', borderRadius:8, fontSize:11, letterSpacing:1 }}>
                ← BACK TO TIMELINE
              </button>
            </div>
          )}

          {/* Night info */}
          <div>
            <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:8 }}>NIGHT INFO</div>
            {[
              { label:'NIGHT NAME',  key:'name',  placeholder:'e.g. Sunday Sundown' },
              { label:'DATE',        key:'date',  placeholder:'',                    type:'date' },
              { label:'VENUE',       key:'venue', placeholder:'e.g. Fabric, London' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom:8 }}>
                <div style={{ fontSize:9, color:'#4a4a66', marginBottom:3 }}>{field.label}</div>
                <input
                  type={field.type || 'text'}
                  value={(night as unknown as Record<string,string>)[field.key]}
                  onChange={e => setNight(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{ width:'100%', background:'#06060c', border:'1px solid #1f1f33', color:'#e8e8f0', fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'6px 10px', borderRadius:7, outline:'none', boxSizing:'border-box' }}
                />
              </div>
            ))}
          </div>

          {/* Stats */}
          {night.slots.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'TOTAL TIME', value:`${Math.floor(totalDuration/60)}h ${totalDuration%60}m` },
                { label:'SETS READY', value:`${slotsWithSets}/${night.slots.length}` },
              ].map(s => (
                <div key={s.label} style={{ background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                  <div className="sf-display" style={{ fontSize:20, color:C }}>{s.value}</div>
                  <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Selected slot editor */}
          {selectedSlot && (
            <div style={{ borderTop:'1px solid #1a1a2e', paddingTop:14 }}>
              <SlotEditor slot={selectedSlot} onUpdate={updateSlot} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:'auto', paddingTop:14, borderTop:'1px solid #1a1a2e' }}>
            <button onClick={saveNight} disabled={saving} className="btn-ghost"
              style={{ padding:'9px 0', borderRadius:8, fontSize:12, width:'100%',
                color:savedFlash?C:undefined, borderColor:savedFlash?C:undefined }}>
              {saving?'Saving…':savedFlash?'✓ Saved':'◈ Save Night'}
            </button>
            <button onClick={exportRunsheet} disabled={exporting} className="btn-ghost"
              style={{ padding:'9px 0', borderRadius:8, fontSize:12, width:'100%' }}>
              {exporting?'Exporting…':'↓ Export Runsheet'}
            </button>
            <button onClick={showNights?()=>setShowNights(false):loadNights} className="btn-ghost"
              style={{ padding:'9px 0', borderRadius:8, fontSize:12, width:'100%' }}>
              {showNights?'Hide saved nights':'📋 Saved nights'}
            </button>
          </div>

          {/* Saved nights list */}
          {showNights && nights.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {nights.map(n => (
                <div key={n.id} onClick={() => { setNight(n); setNightId(n.id); setShowNights(false); if (isMobile) setMobileShowResults(true) }}
                  style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:8, padding:'8px 12px', cursor:'pointer', fontSize:12 }}>
                  <div style={{ color:'#e8e8f0', fontWeight:600 }}>{n.name}</div>
                  <div style={{ fontSize:10, color:'#4a4a66' }}>{n.date || 'No date'} · {n.slots?.length || 0} slots</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Timeline canvas ── */}
        <div style={{ flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined, display: isMobile && !mobileShowResults ? 'none' : 'block', overflowY:'auto', overflowX:'auto', padding:24, background:'#07070e', position:'relative' }}>

          {/* Toolbar */}
          <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap', alignItems:'center' }}>
            <button onClick={addSlot} className="btn-cta" style={{ padding:'10px 20px', borderRadius:9, fontSize:13 }}>
              + Add Slot
            </button>
            {night.slots.length > 0 && (
              <button onClick={generateAll} disabled={generatingId !== null}
                style={{ padding:'10px 20px', borderRadius:9, fontSize:13, border:`1.5px solid ${C}`, background:'transparent', color:C, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:700, transition:'.2s' }}>
                {generatingId ? 'Generating…' : '⚡ Generate All Sets'}
              </button>
            )}
            {isMobile && (
              <button onClick={() => setMobileShowResults(false)} className="btn-ghost" style={{ padding:'10px 20px', borderRadius:9, fontSize:13, marginLeft:'auto' }}>
                ⚙ Night Settings
              </button>
            )}
          </div>

          {/* Empty state */}
          {night.slots.length === 0 && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', textAlign:'center', color:'#3a3a58' }}>
              <div className="sf-display" style={{ fontSize:80, color:`${C}08`, letterSpacing:4, marginBottom:-20 }}>NIGHT</div>
              <div className="sf-display" style={{ fontSize:80, color:`${M}08`, letterSpacing:4, marginBottom:32 }}>PLANNER</div>
              <div style={{ fontSize:15, color:'#4a4a66', marginBottom:8 }}>No slots yet</div>
              <div style={{ fontSize:13, color:'#3a3a58', maxWidth:360, lineHeight:1.6 }}>
                Add your first DJ slot to start planning the night. Each slot generates a context-aware set that flows into the next.
              </div>
            </div>
          )}

          {/* Timeline */}
          {night.slots.length > 0 && (
            <div ref={timelineRef}>

              {/* Visual time bar */}
              {night.slots.length > 0 && (
                <div style={{ marginBottom:20, background:'#0a0a14', border:'1px solid #1a1a2e', borderRadius:10, padding:'10px 14px', overflowX:'auto' }}>
                  <div style={{ fontSize:9, color:'#4a4a66', fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:8 }}>TIMELINE</div>
                  <div style={{ display:'flex', height:32, minWidth:600, gap:2 }}>
                    {night.slots.map(slot => {
                      const pct = (slot.duration / totalDuration) * 100
                      return (
                        <div key={slot.id}
                          onClick={() => selectSlot(slot.id)}
                          title={`${slot.djName || 'DJ'} — ${slot.startTime} (${slot.duration}min)`}
                          style={{ width:`${pct}%`, minWidth:20, background:`${slot.color}55`, border:`1px solid ${slot.color}`, borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', transition:'.2s', outline: selectedId === slot.id ? `2px solid ${slot.color}` : 'none' }}>
                          <span style={{ fontSize:9, color:slot.color, fontFamily:'JetBrains Mono,monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'0 4px' }}>
                            {slot.djName || 'DJ'} {slot.startTime}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Slot cards + handoff badges */}
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {night.slots.map((slot, i) => (
                  <div key={slot.id}>
                    <div
                      className={`slot-drag${dragging===slot.id?' dragging':''}${dragOver===slot.id&&dragging!==slot.id?' dragover':''}`}
                      draggable
                      onDragStart={() => onDragStart(slot.id)}
                      onDragOver={e => onDragOver(e, slot.id)}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => onDrop(slot.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      style={{ marginBottom: i < night.slots.length - 1 ? 0 : 0 }}
                    >
                      <SlotCard
                        slot={slot} index={i}
                        onDelete={deleteSlot}
                        onGenerate={generateSlot}
                        onSelect={selectSlot}
                        selected={selectedId === slot.id}
                        generating={generatingId === slot.id}
                      />
                    </div>

                    {/* Handoff badge between slots */}
                    {i < night.slots.length - 1 && (
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0 8px 16px' }}>
                        <div style={{ width:2, height:32, background:'linear-gradient(180deg,transparent,#1a1a2e,transparent)', flexShrink:0 }} />
                        <HandoffBadge s1={slot} s2={night.slots[i+1]} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Expanded set view for selected slot */}
              {selectedSlot?.set && (
                <div style={{ marginTop:24, background:'#0a0a14', border:`1px solid ${selectedSlot.color}44`, borderRadius:14, padding:20 }}>
                  <div style={{ fontSize:9, color:selectedSlot.color, fontFamily:'JetBrains Mono,monospace', letterSpacing:2, marginBottom:8 }}>
                    {selectedSlot.djName || 'DJ'} — TRACKLIST
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:'#e8e8f0', marginBottom:4 }}>
                    {selectedSlot.set.title}
                  </div>
                  {(selectedSlot.set as { handoffNote?: string }).handoffNote && (
                    <div style={{ fontSize:12, color:'#4ade80', marginBottom:12, lineHeight:1.5 }}>
                      ↑ {(selectedSlot.set as { handoffNote?: string }).handoffNote}
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {selectedSlot.set.tracks.map(t => (
                      <div key={t.n} style={{ display:'grid', gridTemplateColumns:'24px 1fr auto', gap:10, alignItems:'center', background:'#06060c', borderRadius:7, padding:'7px 12px' }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:M }}>{String(t.n).padStart(2,'0')}</div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600 }}>{t.title}</div>
                          <div style={{ fontSize:10, color:'#8a8aa8' }}>{t.artist}</div>
                          {t.transition && <div style={{ fontSize:10, color:'#5a5a78', marginTop:1 }}>↳ {t.transition}</div>}
                        </div>
                        <div style={{ fontSize:10, color:'#6a6a8a', fontFamily:'JetBrains Mono,monospace', textAlign:'right' }}>
                          <div style={{ color:C }}>{t.bpm}</div>
                          <div>{t.key}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(selectedSlot.set as { closingNote?: string }).closingNote && (
                    <div style={{ fontSize:12, color:'#f59e0b', marginTop:12, lineHeight:1.5 }}>
                      ↓ {(selectedSlot.set as { closingNote?: string }).closingNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
