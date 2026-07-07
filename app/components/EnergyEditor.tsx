// ▸ Place at: app/components/EnergyEditor.tsx

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const C = '#00f0ff'
const M = '#ff1e8a'

// ── SVG layout constants ──────────────────────────────────────
const VW = 500, VH = 150
const PL = 32, PR = 16, PT = 14, PB = 32
const UW = VW - PL - PR   // 452
const UH = VH - PT - PB   // 104

// ── Coordinate helpers ────────────────────────────────────────
function eToY(e: number) { return PT + (1 - (e - 1) / 9) * UH }
function yToE(y: number) { return Math.max(1, Math.min(10, Math.round(1 + (1 - (y - PT) / UH) * 9))) }
function iToX(i: number, n: number) { return PL + (i / (n - 1)) * UW }

// ── Catmull-Rom → Cubic Bezier path ──────────────────────────
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

// ── Resampling ────────────────────────────────────────────────
// Stretches/compresses any preset checkpoint array to exactly n points via
// linear interpolation — same math the server uses (interpolateEnergy in
// app/api/generate/route.ts) so a preset always fills the current curve
// length, whatever the set's actual track count is.
export function resampleEnergyPoints(points: number[], n: number): number[] {
  if (n <= 1) return [points[Math.floor(points.length / 2)]]
  return Array.from({ length: n }, (_, i) => {
    const t   = i / (n - 1)
    const seg = t * (points.length - 1)
    const lo  = Math.floor(seg)
    const hi  = Math.min(points.length - 1, lo + 1)
    return Math.round(points[lo] + (points[hi] - points[lo]) * (seg - lo))
  })
}

// ── Presets ───────────────────────────────────────────────────
// Checkpoint shapes — always resampled to the curve's current point count
// before use, so these arrays don't need to match track count themselves.
export const ENERGY_PRESETS: Record<string, number[]> = {
  'Slow build':     [3, 4, 5, 6, 7, 8, 9, 10],
  'Sunrise':        [2, 2, 3, 5, 7, 9, 10],
  'Warm-up':        [2, 3, 4, 5, 6, 6, 6],
  'Peak time':      [7, 9, 10, 10, 9, 10, 9],
  'Rollercoaster':  [4, 9, 3, 10, 4, 9, 3],
  'Double drop':    [4, 7, 10, 5, 7, 10, 4],
  'Wave':           [5, 8, 5, 9, 5, 8, 5],
  'Afterhours':     [8, 8, 9, 8, 7, 4, 2],
  'Cool down':      [9, 8, 7, 6, 5, 4, 3],
  'Flat':           [6, 6, 6, 6, 6],
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  points:   number[]                   // 5 energy values [1-10]
  onChange: (pts: number[]) => void
}

export default function EnergyEditor({ points, onChange }: Props) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [hovered,  setHovered]  = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const N = points.length

  const xs   = points.map((_, i) => iToX(i, N))
  const ys   = points.map(eToY)
  const svgPts = xs.map((x, i) => ({ x, y: ys[i] }))
  const curve  = smoothPath(svgPts)
  const fill   = curve
    + ` L ${xs[N - 1].toFixed(1)} ${(PT + UH).toFixed(1)}`
    + ` L ${xs[0].toFixed(1)} ${(PT + UH).toFixed(1)} Z`

  // ── Pointer helpers ──────────────────────────────────────────
  function getEnergyFromClientY(clientY: number): number {
    if (!svgRef.current) return 5
    const rect   = svgRef.current.getBoundingClientRect()
    const scaleY = VH / rect.height
    return yToE((clientY - rect.top) * scaleY)
  }

  const applyDrag = useCallback((clientY: number) => {
    if (dragging === null) return
    const newPts = [...points]
    newPts[dragging] = getEnergyFromClientY(clientY)
    onChange(newPts)
  }, [dragging, points, onChange])

  // Mouse
  const onMouseMove = useCallback((e: MouseEvent) => applyDrag(e.clientY), [applyDrag])
  const onMouseUp   = useCallback(() => setDragging(null), [])
  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup',   onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [dragging, onMouseMove, onMouseUp])

  // Touch
  function onTouchMove(e: React.TouchEvent) {
    if (dragging === null) return
    e.preventDefault()
    applyDrag(e.touches[0].clientY)
  }

  // ── Active preset detection ──────────────────────────────────
  function isActivePreset(vals: number[]) {
    const resampled = resampleEnergyPoints(vals, N)
    return resampled.every((v, i) => v === points[i])
  }

  return (
    <div>
      {/* Preset chips */}
      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
        {Object.entries(ENERGY_PRESETS).map(([name, vals]) => {
          const active = isActivePreset(vals)
          return (
            <button
              key={name}
              onClick={() => onChange(resampleEnergyPoints(vals, N))}
              style={{
                background: active ? `linear-gradient(90deg,${M}22,${C}22)` : 'transparent',
                border: `1px solid ${active ? C : '#23233a'}`,
                color: active ? C : '#8a8aa8',
                padding: '5px 12px', borderRadius: 999,
                fontSize: 11, cursor: 'pointer',
                fontFamily: "'JetBrains Mono',monospace",
                transition: '.15s',
                boxShadow: active ? `0 0 10px ${C}33` : 'none',
              }}
            >
              {name}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:14, overflow:'hidden', userSelect:'none' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width:'100%', display:'block', touchAction:'none', cursor: dragging !== null ? 'grabbing' : 'default' }}
          onTouchMove={onTouchMove}
          onTouchEnd={() => setDragging(null)}
        >
          <defs>
            <linearGradient id="ef-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C} stopOpacity="0.2" />
              <stop offset="100%" stopColor={C} stopOpacity="0.01" />
            </linearGradient>
            <filter id="pt-glow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Horizontal grid lines + Y labels */}
          {[2, 4, 6, 8, 10].map(e => {
            const y = eToY(e)
            return (
              <g key={e}>
                <line x1={PL} y1={y} x2={VW - PR} y2={y} stroke="#141424" strokeWidth={1} />
                <text x={PL - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#3a3a58" fontFamily="'JetBrains Mono',monospace">{e}</text>
              </g>
            )
          })}

          {/* X axis labels — just Start / Mid / End, regardless of point count */}
          {[
            { i: 0, label: 'START' },
            { i: Math.floor((N - 1) / 2), label: 'MID' },
            { i: N - 1, label: 'END' },
          ].filter((pt, k, arr) => arr.findIndex(p => p.i === pt.i) === k).map(({ i, label }, k) => (
            <text key={k} x={iToX(i, N)} y={VH - 10} textAnchor="middle" fontSize={9} fill="#3a3a58" fontFamily="'JetBrains Mono',monospace">
              {label}
            </text>
          ))}

          {/* Fill */}
          <path d={fill} fill="url(#ef-grad)" />

          {/* Curve */}
          <path d={curve} fill="none" stroke={C} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Segment highlights — glow on hover */}
          {svgPts.map((pt, i) => i < N - 1 && hovered === i ? (
            <line key={i}
              x1={pt.x} y1={pt.y}
              x2={svgPts[i+1].x} y2={svgPts[i+1].y}
              stroke={C} strokeWidth={4} strokeLinecap="round" opacity={0.4}
            />
          ) : null)}

          {/* Control points */}
          {svgPts.map((pt, i) => {
            const isDragging = dragging === i
            const isHovered  = hovered  === i
            const color      = isDragging ? M : C
            const r          = isDragging ? 8 : isHovered ? 7 : 6

            return (
              <g
                key={i}
                onMouseDown={e => { e.preventDefault(); setDragging(i) }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onTouchStart={e => { e.preventDefault(); setDragging(i) }}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                filter="url(#pt-glow)"
              >
                {/* Large invisible hit target */}
                <circle cx={pt.x} cy={pt.y} r={18} fill="transparent" />
                {/* Outer ring */}
                <circle cx={pt.x} cy={pt.y} r={r + 4} fill={`${color}22`} stroke={`${color}44`} strokeWidth={1} />
                {/* Main dot */}
                <circle cx={pt.x} cy={pt.y} r={r} fill={color} stroke="#06060c" strokeWidth={2} />
                {/* Energy label — always visible */}
                <text
                  x={pt.x} y={isDragging ? pt.y - 20 : pt.y - 16}
                  textAnchor="middle"
                  fontSize={isDragging ? 13 : 10}
                  fontWeight="700"
                  fill={isDragging ? M : '#6a6a8a'}
                  fontFamily="'JetBrains Mono',monospace"
                >
                  {isDragging ? `E${points[i]}` : points[i]}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Bottom hint */}
        <div style={{ padding:'6px 16px 10px', display:'flex', justifyContent:'space-between', fontSize:10, color:'#3a3a58', fontFamily:"'JetBrains Mono',monospace" }}>
          <span style={{ color:'#4a4a66' }}>LOW</span>
          <span>DRAG POINTS TO SHAPE YOUR SET ENERGY</span>
          <span style={{ color:'#4a4a66' }}>HIGH</span>
        </div>
      </div>
    </div>
  )
}