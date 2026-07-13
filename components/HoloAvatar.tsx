'use client'
import { useEffect, useState } from 'react'

// Next-gen holographic profile avatar — a slowly rotating wireframe figure in a
// "scanner chamber", with animated callout lines cycling through profile facts.
// Pure CSS/SVG (no 3D deps) so it runs instantly everywhere.

export type HoloFact = { label: string; value: string }

// Per-persona colour signature, derived from the name so it's stable
function hueFor(name: string): { main: string; soft: string } {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const palettes = [
    { main: '#22d3ee', soft: 'rgba(34,211,238,0.14)' },  // cyan
    { main: '#a78bfa', soft: 'rgba(167,139,250,0.14)' }, // violet
    { main: '#34d399', soft: 'rgba(52,211,153,0.14)' },  // emerald
  ]
  return palettes[h % palettes.length]
}

function Callout({ fact, side, top, color, delay }: { fact: HoloFact | null; side: 'left' | 'right'; top: string; color: string; delay: string }) {
  if (!fact) return null
  return (
    <div
      key={fact.label + fact.value}
      className={`holo-callout absolute flex items-center gap-0 ${side === 'left' ? 'left-2 flex-row' : 'right-2 flex-row-reverse'}`}
      style={{ top, animationDelay: delay, maxWidth: '46%' }}
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

export default function HoloAvatar({
  name,
  facts = [],
  compact = false,
}: {
  name: string
  facts?: HoloFact[]
  compact?: boolean
}) {
  const { main, soft } = hueFor(name)
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
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #131c33 0%, #0b1220 60%, #060a15 100%)' }}>

      {/* grid floor */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 opacity-25"
        style={{
          background: `repeating-linear-gradient(0deg, ${main}22 0 1px, transparent 1px 14px), repeating-linear-gradient(90deg, ${main}22 0 1px, transparent 1px 22px)`,
          maskImage: 'linear-gradient(to top, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
        }} />

      {/* HUD corner brackets */}
      {!compact && ['top-2 left-2 border-t border-l', 'top-2 right-2 border-t border-r', 'bottom-2 left-2 border-b border-l', 'bottom-2 right-2 border-b border-r'].map((cls) => (
        <span key={cls} className={`absolute w-4 h-4 ${cls}`} style={{ borderColor: main + '66' }} />
      ))}

      {/* halo */}
      <div className="holo-halo absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: '72%', paddingTop: '72%', background: `radial-gradient(circle, ${soft} 0%, transparent 62%)` }} />

      {/* rotating figure */}
      <div className="absolute inset-x-0 top-[6%] bottom-[18%] flex items-end justify-center" style={{ perspective: '700px' }}>
        <div className="holo-spin h-full" style={{ filter: `drop-shadow(0 0 14px ${main}66)` }}>
          <svg viewBox="0 0 200 250" className="h-full w-auto" aria-label={`AI profile: ${name}`}>
            <defs>
              <linearGradient id="holoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={main} stopOpacity="0.32" />
                <stop offset="100%" stopColor={main} stopOpacity="0.05" />
              </linearGradient>
              <clipPath id="holoClip">
                <path d="M100 22 C124 22 138 44 138 68 C138 88 128 104 116 112 L116 124 C150 132 176 158 182 250 L18 250 C24 158 50 132 84 124 L84 112 C72 104 62 88 62 68 C62 44 76 22 100 22 Z" />
              </clipPath>
            </defs>
            {/* silhouette */}
            <path d="M100 22 C124 22 138 44 138 68 C138 88 128 104 116 112 L116 124 C150 132 176 158 182 250 L18 250 C24 158 50 132 84 124 L84 112 C72 104 62 88 62 68 C62 44 76 22 100 22 Z"
              fill="url(#holoFill)" stroke={main} strokeOpacity="0.9" strokeWidth="1.4" />
            {/* wireframe latitude lines */}
            <g clipPath="url(#holoClip)" stroke={main} strokeOpacity="0.35" strokeWidth="0.8">
              {Array.from({ length: 16 }, (_, i) => (
                <line key={i} x1="0" x2="200" y1={26 + i * 15} y2={26 + i * 15} />
              ))}
            </g>
            {/* pulsing core */}
            <circle className="holo-core" cx="100" cy="172" r="10" fill={main} fillOpacity="0.8" />
            <circle className="holo-core-ring" cx="100" cy="172" r="16" fill="none" stroke={main} strokeOpacity="0.5" />
          </svg>
        </div>
      </div>

      {/* scanline sweep */}
      <div className="holo-scan absolute inset-x-[12%] h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${main}, transparent)`, boxShadow: `0 0 10px 1px ${main}` }} />

      {/* pedestal rings (full 360 rotation) */}
      <div className="absolute left-1/2 bottom-[9%] -translate-x-1/2" style={{ perspective: '400px' }}>
        <div className="holo-ring rounded-full border" style={{ width: compact ? 70 : 150, height: compact ? 22 : 44, borderColor: main + '88' }} />
        <div className="holo-ring-2 absolute inset-0 m-auto rounded-full border border-dashed" style={{ width: compact ? 52 : 112, height: compact ? 16 : 33, borderColor: main + '55' }} />
      </div>

      {/* orbiting particle */}
      {!compact && (
        <div className="absolute left-1/2 top-[46%]" >
          <span className="holo-orbit block w-1.5 h-1.5 rounded-full" style={{ background: main, boxShadow: `0 0 8px 2px ${main}` }} />
        </div>
      )}

      {/* cycling callouts */}
      {!compact && (
        <>
          <Callout fact={slot(0)} side="right" top="14%" color={main} delay="0s" />
          <Callout fact={slot(1)} side="left" top="38%" color={main} delay="0.35s" />
          <Callout fact={slot(2)} side="right" top="60%" color={main} delay="0.7s" />
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
            Target profile // AI-generated
          </p>
        )}
      </div>

      <style>{`
        .holo-spin { animation: holoSpin 14s ease-in-out infinite; transform-style: preserve-3d; }
        @keyframes holoSpin {
          0% { transform: rotateY(0deg); opacity: 1; }
          25% { transform: rotateY(88deg); opacity: 0.55; }
          50% { transform: rotateY(180deg); opacity: 1; }
          75% { transform: rotateY(272deg); opacity: 0.55; }
          100% { transform: rotateY(360deg); opacity: 1; }
        }
        .holo-scan { animation: holoScan 3.6s linear infinite; }
        @keyframes holoScan { 0% { top: 8%; opacity: 0; } 8% { opacity: 0.9; } 88% { opacity: 0.9; } 100% { top: 78%; opacity: 0; } }
        .holo-ring { animation: holoRing 6s linear infinite; }
        .holo-ring-2 { animation: holoRing 9s linear infinite reverse; }
        @keyframes holoRing { from { transform: rotateX(72deg) rotateZ(0deg); } to { transform: rotateX(72deg) rotateZ(360deg); } }
        .holo-orbit { animation: holoOrbit 7s linear infinite; }
        @keyframes holoOrbit {
          0%   { transform: translateX(-70px) scale(1);   opacity: 1; }
          25%  { transform: translateX(0) scale(0.6);     opacity: 0.4; }
          50%  { transform: translateX(70px) scale(1);    opacity: 1; }
          75%  { transform: translateX(0) scale(1.25);    opacity: 1; }
          100% { transform: translateX(-70px) scale(1);   opacity: 1; }
        }
        .holo-core { animation: holoCore 2.2s ease-in-out infinite; transform-origin: 100px 172px; }
        .holo-core-ring { animation: holoCore 2.2s ease-in-out infinite 0.3s; transform-origin: 100px 172px; }
        @keyframes holoCore { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.35); opacity: 0.35; } }
        .holo-halo { animation: holoCore 4.5s ease-in-out infinite; }
        .holo-dot { animation: holoCore 1.6s ease-in-out infinite; }
        .holo-callout { animation: holoIn 0.6s ease-out both; }
        @keyframes holoIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .holo-spin, .holo-scan, .holo-ring, .holo-ring-2, .holo-orbit, .holo-core, .holo-core-ring, .holo-halo, .holo-dot, .holo-callout { animation: none; }
        }
      `}</style>
    </div>
  )
}
