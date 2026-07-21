'use client'
import { useEffect, useRef, useState } from 'react'
import SvgHolo, { type HoloFact, hueFor, seedFrom } from './HoloFigure'

// Real WebGL 3D biometric scan: a humanoid POINT CLOUD (volumetric body) with
// glowing joint nodes wired by bones, rotating with genuine depth on a
// perspective grid. Falls back to the SVG figure if WebGL is unavailable.

// Joint positions in 3D (x right, y up, z depth; screen-left = negative x)
const J: [number, number, number][] = [
  [0, 1.55, 0], [0, 1.15, 0], [-0.42, 1.0, 0], [0.42, 1.0, 0], [0, 0.72, 0.05],
  [-0.62, 0.42, 0.02], [0.62, 0.42, 0.02], [-0.72, -0.12, 0.05], [0.72, -0.12, 0.05],
  [0, 0.02, 0.03], [-0.22, 0.0, 0.02], [0.22, 0.0, 0.02],
  [-0.24, -0.95, 0.03], [0.24, -0.95, 0.03], [-0.22, -1.82, 0], [0.22, -1.82, 0],
]
const BONES: [number, number][] = [
  [0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [5, 7], [3, 6], [6, 8],
  [4, 9], [9, 10], [9, 11], [10, 12], [12, 14], [11, 13], [13, 15],
]
const BONE_RADIUS = [0.09, 0.15, 0.15, 0.16, 0.09, 0.075, 0.09, 0.075, 0.26, 0.14, 0.14, 0.12, 0.08, 0.12, 0.08]
const BONE_COUNT = [40, 90, 90, 90, 60, 60, 60, 60, 200, 80, 80, 90, 60, 90, 60]
const TORSO_BONE = 8

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildCloud(rand: () => number): Float32Array {
  const p: number[] = []
  // head sphere
  for (let i = 0; i < 150; i++) {
    const th = 2 * Math.PI * rand(), ph = Math.acos(2 * rand() - 1), r = 0.2 * Math.cbrt(rand())
    p.push(J[0][0] + r * Math.sin(ph) * Math.cos(th), J[0][1] + r * Math.cos(ph), J[0][2] + r * Math.sin(ph) * Math.sin(th))
  }
  BONES.forEach(([a, b], bi) => {
    const R = BONE_RADIUS[bi]
    for (let i = 0; i < BONE_COUNT[bi]; i++) {
      const t = rand()
      const x = J[a][0] + (J[b][0] - J[a][0]) * t
      const y = J[a][1] + (J[b][1] - J[a][1]) * t
      const z = J[a][2] + (J[b][2] - J[a][2]) * t
      const th = 2 * Math.PI * rand(), ph = Math.acos(2 * rand() - 1), rr = R * Math.cbrt(rand())
      let ox = rr * Math.sin(ph) * Math.cos(th), oy = rr * Math.cos(ph) * 0.55, oz = rr * Math.sin(ph) * Math.sin(th)
      if (bi === TORSO_BONE) { ox *= 1.5; oz *= 0.7 } // slab-shaped torso
      p.push(x + ox, y + oy, z + oz)
    }
  })
  return new Float32Array(p)
}

function Callout({ fact, side, top, color }: { fact: HoloFact | null; side: 'left' | 'right'; top: string; color: string }) {
  if (!fact) return null
  return (
    <div key={fact.label + fact.value}
      className={`holo3-callout absolute flex items-center gap-0 ${side === 'left' ? 'left-2 flex-row' : 'right-2 flex-row-reverse'}`}
      style={{ top, maxWidth: '46%' }}>
      <div className={`px-2 py-1 rounded border backdrop-blur-sm ${side === 'left' ? 'text-left' : 'text-right'}`}
        style={{ borderColor: color + '55', background: 'rgba(2,6,23,0.72)' }}>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>{fact.label}</p>
        <p className="text-[11px] text-slate-200 leading-tight line-clamp-2">{fact.value}</p>
      </div>
      <div className="h-px w-5 sm:w-8 shrink-0" style={{ background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, ${color}, transparent)` }} />
      <span className="holo3-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
    </div>
  )
}

export default function HoloAvatar3D({ name, facts = [] }: { name: string; facts?: HoloFact[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const { main } = hueFor(name)

  // cycling callouts
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (facts.length === 0) return
    const t = setInterval(() => setTick((v) => v + 1), 3200)
    return () => clearInterval(t)
  }, [facts.length])
  const slot = (i: number): HoloFact | null => facts.length === 0 ? null : facts[(tick * 3 + i) % facts.length]

  useEffect(() => {
    let raf = 0
    let disposed = false
    const cleanups: Array<() => void> = []

    ;(async () => {
      try {
        const THREE = await import('three')
        const canvas = canvasRef.current, wrap = wrapRef.current
        if (!canvas || !wrap || disposed) return

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setClearAlpha(0)

        const scene = new THREE.Scene()
        scene.fog = new THREE.Fog(0x060a15, 3.0, 8.2)
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
        camera.position.set(0, 0.18, 3.75)
        camera.lookAt(0, 0.0, 0)

        const color = new THREE.Color(main)

        // soft round sprite for glowing points
        const tc = document.createElement('canvas'); tc.width = tc.height = 64
        const g2 = tc.getContext('2d')!
        const grd = g2.createRadialGradient(32, 32, 0, 32, 32, 32)
        grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
        g2.fillStyle = grd; g2.fillRect(0, 0, 64, 64)
        const sprite = new THREE.CanvasTexture(tc)

        const group = new THREE.Group()

        // body point cloud
        const rand = mulberry32(seedFrom(name))
        const cloudGeo = new THREE.BufferGeometry()
        cloudGeo.setAttribute('position', new THREE.BufferAttribute(buildCloud(rand), 3))
        const cloudMat = new THREE.PointsMaterial({ size: 0.055, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color, opacity: 0.85, sizeAttenuation: true })
        group.add(new THREE.Points(cloudGeo, cloudMat))

        // bones
        const bp: number[] = []
        BONES.forEach(([a, b]) => bp.push(...J[a], ...J[b]))
        const boneGeo = new THREE.BufferGeometry()
        boneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bp), 3))
        group.add(new THREE.LineSegments(boneGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })))

        // joint nodes (glow + white core)
        const nodeGeo = new THREE.BufferGeometry()
        nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(J.flat()), 3))
        group.add(new THREE.Points(nodeGeo, new THREE.PointsMaterial({ size: 0.2, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color })))
        group.add(new THREE.Points(nodeGeo, new THREE.PointsMaterial({ size: 0.085, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0xeafcff) })))

        scene.add(group)

        // grid floor (does not rotate with the figure)
        const grid = new THREE.GridHelper(7, 28, color, color)
        ;(grid.material as InstanceType<typeof THREE.Material>).transparent = true
        ;(grid.material as unknown as { opacity: number }).opacity = 0.16
        grid.position.y = -1.86
        scene.add(grid)

        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        if (reduce) group.rotation.y = -0.5

        const resize = () => {
          const w = wrap.clientWidth, h = wrap.clientHeight
          if (!w || !h) return
          renderer.setSize(w, h, false)
          camera.aspect = w / h; camera.updateProjectionMatrix()
        }
        resize()
        const ro = new ResizeObserver(resize); ro.observe(wrap); cleanups.push(() => ro.disconnect())

        const clock = new THREE.Clock()
        const loop = () => {
          if (disposed) return
          raf = requestAnimationFrame(loop)
          const dt = clock.getDelta()
          if (!reduce) group.rotation.y += dt * 0.32
          renderer.render(scene, camera)
        }
        loop()
        setReady(true)

        cleanups.push(() => {
          cancelAnimationFrame(raf)
          cloudGeo.dispose(); boneGeo.dispose(); nodeGeo.dispose(); sprite.dispose()
          renderer.dispose()
        })
      } catch {
        if (!disposed) setFailed(true)
      }
    })()

    return () => { disposed = true; cleanups.forEach((c) => c()) }
  }, [name, main])

  if (failed) return <SvgHolo name={name} facts={facts} />

  return (
    <div ref={wrapRef} className="relative w-full h-full min-h-[300px] overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 34%, #101a30 0%, #0a1120 58%, #05080f 100%)' }}>
      <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} />

      {/* SVG stand-in until the 3D scene is live */}
      {!ready && <div className="absolute inset-0"><SvgHolo name={name} facts={facts} /></div>}

      {/* HUD chrome */}
      {['top-2 left-2 border-t border-l', 'top-2 right-2 border-t border-r', 'bottom-2 left-2 border-b border-l', 'bottom-2 right-2 border-b border-r'].map((cls) => (
        <span key={cls} className={`absolute w-4 h-4 ${cls}`} style={{ borderColor: main + '66' }} />
      ))}
      <div className="holo3-scan absolute inset-x-[10%] h-px" style={{ background: `linear-gradient(90deg, transparent, ${main}, transparent)`, boxShadow: `0 0 10px 1px ${main}` }} />

      {ready && (
        <>
          <Callout fact={slot(0)} side="right" top="13%" color={main} />
          <Callout fact={slot(1)} side="left" top="40%" color={main} />
          <Callout fact={slot(2)} side="right" top="62%" color={main} />
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-6" style={{ background: 'linear-gradient(to top, rgba(3,7,18,0.95), transparent)' }}>
        <div className="flex items-center gap-1.5">
          <span className="holo3-dot w-1.5 h-1.5 rounded-full" style={{ background: main, boxShadow: `0 0 6px ${main}` }} />
          <p className="font-mono uppercase tracking-[0.18em] text-slate-100 text-sm truncate">{name}</p>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] mt-0.5" style={{ color: main }}>Biometric target profile // AI-generated</p>
      </div>

      <style>{`
        .holo3-scan { animation: holo3Scan 3.6s linear infinite; }
        @keyframes holo3Scan { 0% { top: 6%; opacity: 0; } 8% { opacity: 0.9; } 88% { opacity: 0.9; } 100% { top: 80%; opacity: 0; } }
        .holo3-dot { animation: holo3Dot 1.6s ease-in-out infinite; }
        @keyframes holo3Dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .holo3-callout { animation: holo3In 0.6s ease-out both; }
        @keyframes holo3In { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .holo3-scan, .holo3-dot, .holo3-callout { animation: none; } }
      `}</style>
    </div>
  )
}
