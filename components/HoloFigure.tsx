'use client'
import { useEffect, useMemo, useState } from 'react'

// Next-gen holographic profile avatar — a biometric body scan: a standing
// figure with glowing joint nodes wired into a skeleton, particle dissolve,
// slow 360 rotation on a grid floor, and callout lines cycling profile facts.
// Pure CSS/SVG (no 3D deps) so it runs instantly everywhere.

export type HoloFact = { label: string; value: string }

// Deterministic PRNG (seeded from the name) so server + client renders match
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seedFrom(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h || 1
}
export function hueFor(name: string): { main: string; soft: string } {
  const palettes = [
    { main: '#22d3ee', soft: 'rgba(34,211,238,0.14)' },  // cyan
    { main: '#38bdf8', soft: 'rgba(56,189,248,0.14)' },  // sky
    { main: '#a78bfa', soft: 'rgba(167,139,250,0.14)' }, // violet
    { main: '#34d399', soft: 'rgba(52,211,153,0.14)' },  // emerald
  ]
  return palettes[seedFrom(name) % palettes.length]
}

// Joint nodes (viewBox 200 x 252). Order matters for the bones list below.
const N = [
  [100, 28],  // 0 head
  [100, 50],  // 1 neck
  [77, 60],   // 2 L shoulder
  [123, 60],  // 3 R shoulder
  [100, 76],  // 4 chest
  [66, 98],   // 5 L elbow
  [134, 98],  // 6 R elbow
  [61, 132],  // 7 L wrist
  [139, 132], // 8 R wrist
  [100, 120], // 9 pelvis
  [87, 120],  // 10 L hip
  [113, 120], // 11 R hip
  [90, 176],  // 12 L knee
  [110, 176], // 13 R knee
  [92, 224],  // 14 L ankle
  [108, 224], // 15 R ankle
] as const
const BONES: [number, number][] = [
  [0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [5, 7], [3, 6], [6, 8],
  [4, 9], [9, 10], [9, 11], [10, 12], [12, 14], [11, 13], [13, 15],
]

function Callout({ fact, side, top, color }: { fact: HoloFact | null; side: 'left' | 'right'; top: string; color: string }) {
  if (!fact) return null
  return (
    <div
      key={fact.label + fact.value}
      className={`holo-callout absolute flex items-center gap-0 ${side === 'left' ? 'left-2 flex-row' : 'right-2 flex-row-reverse'}`}
      style={{ top, maxWidth: '46%' }}
    >
      <div className={`px-2 py-1 rounded border backdrop-blur-sm ${side === 'left' ? 'text-left' : 'text-right'}`}
        style={{ borderColor: color + '55', background: 'rgba(2,6,23,0.72)' }}>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>{fact.label}</p>
        <p className="text-[11px] text-slate-200 leading-tight line-clamp-2">{fact.value}</p>
      </div>
      <div className="h-px w-5 sm:w-8 shrink-0" style={{ background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, ${color}, transparent)` }} />
      <span className="holo-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
    </div>
  )
}

export default function SvgHolo({
  name,
  facts = [],
  compact = false,
}: {
  name: string
  facts?: HoloFact[]
  compact?: boolean
}) {
  const { main, soft } = hueFor(name)

  // Particle dissolve — left-weighted haze, deterministic per name
  const particles = useMemo(() => {
    const rand = mulberry32(seedFrom(name))
    const count = compact ? 0 : 46
    return Array.from({ length: count }, () => {
      const leftBias = rand() < 0.65
      return {
        x: leftBias ? 12 + rand() * 44 : 45 + rand() * 45,
        y: 14 + rand() * 74,
        s: 1 + rand() * 1.6,
        o: 0.15 + rand() * 0.5,
        d: (rand() * 4).toFixed(2),
        dur: (2.5 + rand() * 3).toFixed(2),
      }
    })
  }, [name, compact])

  // Cycle which facts occupy the three callout slots
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (compact || facts.length === 0) return
    const t = setInterval(() => setTick((v) => v + 1), 3200)
    return () => clearInterval(t)
  }, [compact, facts.length])
  const slot = (i: number): HoloFact | null =>
    facts.length === 0 ? null : facts[(tick * 3 + i) % facts.length]

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${compact ? '' : 'min-h-[300px]'}`}
      style={{ background: 'radial-gradient(ellipse at 50% 34%, #101a30 0%, #0a1120 58%, #05080f 100%)' }}>

      {/* grid floor */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 opacity-25"
        style={{
          background: `repeating-linear-gradient(0deg, ${main}22 0 1px, transparent 1px 15px), repeating-linear-gradient(90deg, ${main}22 0 1px, transparent 1px 24px)`,
          maskImage: 'linear-gradient(to top, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
        }} />

      {/* HUD corner brackets */}
      {!compact && ['top-2 left-2 border-t border-l', 'top-2 right-2 border-t border-r', 'bottom-2 left-2 border-b border-l', 'bottom-2 right-2 border-b border-r'].map((cls) => (
        <span key={cls} className={`absolute w-4 h-4 ${cls}`} style={{ borderColor: main + '66' }} />
      ))}

      {/* halo */}
      <div className="holo-halo absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: '70%', paddingTop: '70%', background: `radial-gradient(circle, ${soft} 0%, transparent 62%)` }} />

      {/* particle dissolve */}
      {particles.map((p, i) => (
        <span key={i} className="holo-particle absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, background: main, opacity: p.o, boxShadow: `0 0 ${p.s * 2}px ${main}`, animationDelay: `${p.d}s`, animationDuration: `${p.dur}s` }} />
      ))}

      {/* rotating scan figure */}
      <div className="absolute inset-x-0 top-[4%] bottom-[16%] flex items-center justify-center" style={{ perspective: '760px' }}>
        <div className="holo-spin h-full" style={{ filter: `drop-shadow(0 0 12px ${main}55)` }}>
          <svg viewBox="0 0 200 252" className="h-full w-auto" aria-label={`AI biometric profile: ${name}`}>
            <defs>
              <filter id="holoGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.4" />
              </filter>
              <radialGradient id="holoBody" cx="50%" cy="38%" r="65%">
                <stop offset="0%" stopColor={main} stopOpacity="0.22" />
                <stop offset="100%" stopColor={main} stopOpacity="0.03" />
              </radialGradient>
            </defs>

            {/* body mass — thick translucent capsules along the skeleton */}
            <g stroke={main} strokeOpacity="0.11" strokeLinecap="round" fill="none">
              {BONES.map(([a, b], i) => (
                <line key={i} x1={N[a][0]} y1={N[a][1]} x2={N[b][0]} y2={N[b][1]} strokeWidth={a === 0 || b === 0 ? 8 : 15} />
              ))}
            </g>
            {/* torso volume + head */}
            <path d="M77,60 C90,54 110,54 123,60 L116,122 C110,127 90,127 84,122 Z" fill="url(#holoBody)" stroke={main} strokeOpacity="0.4" strokeWidth="0.8" />
            <circle cx="100" cy="28" r="14" fill="url(#holoBody)" stroke={main} strokeOpacity="0.85" strokeWidth="1.2" />

            {/* skeleton bones (bright) */}
            <g stroke={main} strokeOpacity="0.6" strokeWidth="1" strokeLinecap="round">
              {BONES.map(([a, b], i) => (
                <line key={i} x1={N[a][0]} y1={N[a][1]} x2={N[b][0]} y2={N[b][1]} />
              ))}
            </g>

            {/* node glow (blurred) */}
            <g filter="url(#holoGlow)" fill={main}>
              {N.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 6 : 4.5} opacity="0.9" />)}
            </g>
            {/* node cores (crisp, pulsing) */}
            <g>
              {N.map(([x, y], i) => (
                <circle key={i} className="holo-node" cx={x} cy={y} r={i === 0 ? 2.6 : 2} fill="#eafcff"
                  style={{ animationDelay: `${(i % 6) * 0.25}s`, transformOrigin: `${x}px ${y}px` }} />
              ))}
            </g>
          </svg>
        </div>
      </div>

      {/* scanline sweep */}
      <div className="holo-scan absolute inset-x-[10%] h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${main}, transparent)`, boxShadow: `0 0 10px 1px ${main}` }} />

      {/* pedestal rings (full 360 rotation) */}
      <div className="absolute left-1/2 bottom-[8%] -translate-x-1/2" style={{ perspective: '400px' }}>
        <div className="holo-ring rounded-full border" style={{ width: compact ? 66 : 152, height: compact ? 20 : 46, borderColor: main + '88' }} />
        <div className="holo-ring-2 absolute inset-0 m-auto rounded-full border border-dashed" style={{ width: compact ? 48 : 112, height: compact ? 14 : 34, borderColor: main + '55' }} />
      </div>

      {/* orbiting particle */}
      {!compact && (
        <div className="absolute left-1/2 top-[46%]">
          <span className="holo-orbit block w-1.5 h-1.5 rounded-full" style={{ background: main, boxShadow: `0 0 8px 2px ${main}` }} />
        </div>
      )}

      {/* cycling callouts */}
      {!compact && (
        <>
          <Callout fact={slot(0)} side="right" top="13%" color={main} />
          <Callout fact={slot(1)} side="left" top="40%" color={main} />
          <Callout fact={slot(2)} side="right" top="62%" color={main} />
        </>
      )}

      {/* name plate */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-6"
        style={{ background: 'linear-gradient(to top, rgba(3,7,18,0.95), transparent)' }}>
        <div className="flex items-center gap-1.5">
          <span className="holo-dot w-1.5 h-1.5 rounded-full" style={{ background: main, boxShadow: `0 0 6px ${main}` }} />
          <p className={`font-mono uppercase tracking-[0.18em] text-slate-100 ${compact ? 'text-[10px]' : 'text-sm'} truncate`}>{name}</p>
        </div>
        {!compact && (
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] mt-0.5" style={{ color: main }}>
            Biometric target profile // AI-generated
          </p>
        )}
      </div>

      <style>{`
        .holo-spin { animation: holoSpin 15s ease-in-out infinite; transform-style: preserve-3d; }
        @keyframes holoSpin {
          0% { transform: rotateY(0deg); opacity: 1; }
          25% { transform: rotateY(90deg); opacity: 0.5; }
          50% { transform: rotateY(180deg); opacity: 1; }
          75% { transform: rotateY(270deg); opacity: 0.5; }
          100% { transform: rotateY(360deg); opacity: 1; }
        }
        .holo-node { animation: holoNode 2.4s ease-in-out infinite; }
        @keyframes holoNode { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.6; } }
        .holo-particle { animation: holoDust ease-in-out infinite; }
        @keyframes holoDust { 0%,100% { opacity: 0.15; transform: translateY(0); } 50% { opacity: 0.7; transform: translateY(-4px); } }
        .holo-scan { animation: holoScan 3.6s linear infinite; }
        @keyframes holoScan { 0% { top: 6%; opacity: 0; } 8% { opacity: 0.9; } 88% { opacity: 0.9; } 100% { top: 80%; opacity: 0; } }
        .holo-ring { animation: holoRing 6s linear infinite; }
        .holo-ring-2 { animation: holoRing 9s linear infinite reverse; }
        @keyframes holoRing { from { transform: rotateX(72deg) rotateZ(0deg); } to { transform: rotateX(72deg) rotateZ(360deg); } }
        .holo-orbit { animation: holoOrbit 7s linear infinite; }
        @keyframes holoOrbit {
          0%   { transform: translateX(-72px) scale(1);   opacity: 1; }
          25%  { transform: translateX(0) scale(0.6);     opacity: 0.4; }
          50%  { transform: translateX(72px) scale(1);    opacity: 1; }
          75%  { transform: translateX(0) scale(1.25);    opacity: 1; }
          100% { transform: translateX(-72px) scale(1);   opacity: 1; }
        }
        .holo-halo { animation: holoHalo 4.5s ease-in-out infinite; }
        @keyframes holoHalo { 0%,100% { opacity: 0.85; } 50% { opacity: 0.4; } }
        .holo-dot { animation: holoHalo 1.6s ease-in-out infinite; }
        .holo-callout { animation: holoIn 0.6s ease-out both; }
        @keyframes holoIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .holo-spin, .holo-node, .holo-particle, .holo-scan, .holo-ring, .holo-ring-2, .holo-orbit, .holo-halo, .holo-dot, .holo-callout { animation: none; }
        }
      `}</style>
    </div>
  )
}
