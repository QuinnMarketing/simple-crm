'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Move, Ruler, Square, Hash, Trash2, Plus, Check, X, Loader2, ImageIcon, ChevronDown } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Point = { x: number; y: number }

type Scale = {
  p1: Point; p2: Point
  pixelDist: number; realDist: number; unit: string
}

type MeasType = 'count' | 'linear' | 'area'

type Measurement = {
  id: string
  type: MeasType
  points: Point[]
  value: number
  unit: string
  label: string
  color: string
  addedToTakeoff?: boolean
}

type Plan = {
  id: string
  takeoffId: string
  name: string
  imageData?: string
  scale: string | null
  measurements: string
  order: number
}

type ParsedPlan = Omit<Plan, 'scale' | 'measurements'> & {
  imageData?: string
  parsedScale: Scale | null
  parsedMeasurements: Measurement[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MEAS_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
let _colorIdx = 0
const nextColor = () => MEAS_COLORS[(_colorIdx++) % MEAS_COLORS.length]
const uid = () => Math.random().toString(36).slice(2, 10)
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const polyLen = (pts: Point[]) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0)
const polyArea = (pts: Point[]) => {
  const n = pts.length
  let a = 0
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y }
  return Math.abs(a) / 2
}
const fmtVal = (m: Measurement) =>
  m.type === 'count' ? `${m.value} items` : `${m.value.toFixed(2)} ${m.unit}`

function realValue(type: MeasType, pts: Point[], scale: Scale | null): { value: number; unit: string } {
  if (type === 'count') return { value: pts.length, unit: 'items' }
  if (!scale) return type === 'linear'
    ? { value: parseFloat(polyLen(pts).toFixed(2)), unit: 'px' }
    : { value: parseFloat(polyArea(pts).toFixed(2)), unit: 'px²' }
  const ppu = scale.pixelDist / scale.realDist
  if (type === 'linear') return { value: parseFloat((polyLen(pts) / ppu).toFixed(3)), unit: scale.unit }
  return { value: parseFloat((polyArea(pts) / (ppu * ppu)).toFixed(3)), unit: scale.unit + '²' }
}

// ── Canvas drawing helpers ─────────────────────────────────────────────────────

function drawMeasurement(ctx: CanvasRenderingContext2D, m: Measurement, z: number) {
  const lw = 2.5 / z
  ctx.lineWidth = lw

  if (m.type === 'count') {
    m.points.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 9 / z, 0, Math.PI * 2)
      ctx.fillStyle = m.color + 'cc'; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / z; ctx.stroke()
      ctx.fillStyle = '#fff'; ctx.font = `bold ${9 / z}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), p.x, p.y)
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = lw
    })
    if (m.points.length > 0) {
      const p = m.points[0]
      ctx.fillStyle = m.color; ctx.font = `${10 / z}px sans-serif`
      ctx.fillText(m.label || fmtVal(m), p.x + 12 / z, p.y - 10 / z)
    }
    return
  }

  if (m.points.length < 2) return

  if (m.type === 'linear') {
    ctx.beginPath(); ctx.moveTo(m.points[0].x, m.points[0].y)
    m.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = m.color; ctx.stroke()
    m.points.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 / z, 0, Math.PI * 2)
      ctx.fillStyle = m.color; ctx.fill()
    })
    const mid = m.points[Math.floor(m.points.length / 2)]
    ctx.fillStyle = m.color; ctx.font = `${11 / z}px sans-serif`
    ctx.fillText(m.label ? `${m.label} (${fmtVal(m)})` : fmtVal(m), mid.x + 5 / z, mid.y - 6 / z)
  } else {
    ctx.beginPath(); ctx.moveTo(m.points[0].x, m.points[0].y)
    m.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath()
    ctx.fillStyle = m.color + '30'; ctx.fill()
    ctx.strokeStyle = m.color; ctx.stroke()
    const cx = m.points.reduce((s, p) => s + p.x, 0) / m.points.length
    const cy = m.points.reduce((s, p) => s + p.y, 0) / m.points.length
    ctx.fillStyle = m.color; ctx.font = `bold ${11 / z}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(m.label ? `${m.label} (${fmtVal(m)})` : fmtVal(m), cx, cy)
    ctx.textAlign = 'start'
  }
}

function drawInProgress(ctx: CanvasRenderingContext2D, type: MeasType, pts: Point[], mouse: Point | null, z: number) {
  const color = MEAS_COLORS[_colorIdx % MEAS_COLORS.length]
  ctx.lineWidth = 2 / z

  if (type === 'count') {
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 9 / z, 0, Math.PI * 2)
      ctx.fillStyle = color + 'cc'; ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = `bold ${9 / z}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), p.x, p.y)
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'
    })
    if (mouse) {
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9 / z, 0, Math.PI * 2)
      ctx.fillStyle = color + '55'; ctx.fill()
    }
    return
  }

  if (pts.length === 0) return
  ctx.strokeStyle = color
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
  if (mouse) ctx.lineTo(mouse.x, mouse.y)
  if (type === 'area') {
    ctx.closePath(); ctx.fillStyle = color + '22'; ctx.fill()
  }
  ctx.stroke()
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tool = 'pan' | 'scale' | 'count' | 'linear' | 'area'

export default function PlanMarkup({
  takeoffId,
  sections,
  onAddToTakeoff,
}: {
  takeoffId: string
  sections: string[]
  onAddToTakeoff: (section: string, description: string, quantity: number, unit: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [plans, setPlans] = useState<ParsedPlan[]>([])
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 })
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const [tool, setTool] = useState<Tool>('pan')
  const [curPts, setCurPts] = useState<Point[]>([])
  const [mouse, setMouse] = useState<Point | null>(null)

  const [scalePts, setScalePts] = useState<Point[]>([])
  const [showScaleDlg, setShowScaleDlg] = useState(false)
  const [scaleReal, setScaleReal] = useState('')
  const [scaleUnit, setScaleUnit] = useState('m')

  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [scale, setScale] = useState<Scale | null>(null)

  const [addDlg, setAddDlg] = useState<Measurement | null>(null)
  const [addSection, setAddSection] = useState('')
  const [addLabel, setAddLabel] = useState('')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saving, setSaving] = useState(false)

  const activePlan = plans.find(p => p.id === activePlanId) ?? null

  // Load plans (without imageData — too large for list)
  useEffect(() => {
    fetch(`/api/takeoffs/${takeoffId}/plans`)
      .then(r => r.json())
      .then((data: Plan[]) => {
        const parsed = (Array.isArray(data) ? data : []).map(p => ({
          ...p,
          parsedScale: p.scale ? JSON.parse(p.scale) : null,
          parsedMeasurements: JSON.parse(p.measurements || '[]'),
        }))
        setPlans(parsed)
        if (parsed.length > 0) setActivePlanId(parsed[0].id)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [takeoffId])

  // When active plan changes, fetch its full data (with imageData) then load onto canvas
  useEffect(() => {
    if (!activePlanId) { imgRef.current = null; setMeasurements([]); setScale(null); return }
    const existing = plans.find(p => p.id === activePlanId)
    if (!existing) return

    setMeasurements(existing.parsedMeasurements)
    setScale(existing.parsedScale)
    setCurPts([])

    // If imageData already on plan (just uploaded), use it. Otherwise fetch.
    const imageData = existing.imageData
    if (imageData) {
      loadImage(imageData)
    } else {
      fetch(`/api/takeoffs/${takeoffId}/plans/${activePlanId}`)
        .then(r => r.json())
        .then(d => loadImage(d.imageData))
    }
  }, [activePlanId])

  function loadImage(src: string) {
    const img = new window.Image()
    img.onload = () => {
      imgRef.current = img
      fitToCanvas(img)
    }
    img.src = src
  }

  function fitToCanvas(img: HTMLImageElement) {
    const canvas = canvasRef.current
    if (!canvas) return
    const cw = canvas.clientWidth || 800
    const ch = canvas.clientHeight || 600
    const z = Math.min(cw / img.width, ch / img.height) * 0.92
    const x = (cw - img.width * z) / 2
    const y = (ch - img.height * z) / 2
    viewRef.current = { x, y, zoom: z }
    setPan({ x, y }); setZoom(z)
  }

  // Redraw
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== rect.width) canvas.width = rect.width
    if (canvas.height !== rect.height) canvas.height = rect.height

    const { x: px, y: py, zoom: z } = viewRef.current
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(px, py)
    ctx.scale(z, z)

    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0)
    } else {
      ctx.fillStyle = '#f1f5f9'
      if (imgRef.current === null) {
        // draw placeholder
      }
    }

    // Scale calibration line
    if (scale) {
      ctx.setLineDash([6 / z, 3 / z])
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2 / z
      ctx.beginPath(); ctx.moveTo(scale.p1.x, scale.p1.y); ctx.lineTo(scale.p2.x, scale.p2.y); ctx.stroke()
      ctx.setLineDash([])
      for (const p of [scale.p1, scale.p2]) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 / z, 0, Math.PI * 2)
        ctx.fillStyle = '#22c55e'; ctx.fill()
      }
      const mx = (scale.p1.x + scale.p2.x) / 2, my = (scale.p1.y + scale.p2.y) / 2
      ctx.fillStyle = '#16a34a'; ctx.font = `${11 / z}px sans-serif`
      ctx.fillText(`Scale: ${scale.realDist}${scale.unit}`, mx + 4 / z, my - 6 / z)
    }

    // Scale in-progress
    if (tool === 'scale' && scalePts.length > 0) {
      const p1 = scalePts[0], p2 = mouse ?? p1
      ctx.setLineDash([6 / z, 3 / z])
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2 / z
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
      ctx.setLineDash([])
    }

    for (const m of measurements) drawMeasurement(ctx, m, z)
    if (curPts.length > 0 && tool !== 'pan' && tool !== 'scale') {
      drawInProgress(ctx, tool as MeasType, curPts, mouse, z)
    }

    ctx.restore()
  }, [measurements, scale, curPts, mouse, tool, scalePts])

  useEffect(() => { draw() }, [draw, pan, zoom])

  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [draw])

  function toImage(cp: Point): Point {
    const { x, y, zoom: z } = viewRef.current
    return { x: (cp.x - x) / z, y: (cp.y - y) / z }
  }

  function canvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool === 'pan') {
      dragRef.current = { startX: e.clientX, startY: e.clientY, panX: viewRef.current.x, panY: viewRef.current.y }
      return
    }
    const ip = toImage(canvasPoint(e))
    if (tool === 'scale') {
      if (scalePts.length === 0) { setScalePts([ip]); return }
      setScalePts([scalePts[0], ip])
      setShowScaleDlg(true); setScaleReal('')
      return
    }
    if (tool === 'count') { setCurPts(p => [...p, ip]); return }
    if (e.detail === 2 && curPts.length >= 1) { finishMeasurement(); return }
    setCurPts(p => [...p, ip])
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const cp = canvasPoint(e)
    const ip = toImage(cp)
    setMouse(ip)
    if (tool === 'pan' && dragRef.current) {
      const nx = dragRef.current.panX + (e.clientX - dragRef.current.startX)
      const ny = dragRef.current.panY + (e.clientY - dragRef.current.startY)
      viewRef.current = { ...viewRef.current, x: nx, y: ny }
      setPan({ x: nx, y: ny })
    }
  }

  function handleMouseUp() { dragRef.current = null }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const r = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    const nz = Math.max(0.05, Math.min(20, viewRef.current.zoom * factor))
    const nx = cx - (cx - viewRef.current.x) * (nz / viewRef.current.zoom)
    const ny = cy - (cy - viewRef.current.y) * (nz / viewRef.current.zoom)
    viewRef.current = { x: nx, y: ny, zoom: nz }
    setPan({ x: nx, y: ny }); setZoom(nz)
  }

  function finishMeasurement() {
    if (curPts.length === 0) return
    if ((tool === 'linear' || tool === 'area') && curPts.length < 2) return
    const { value, unit } = realValue(tool as MeasType, curPts, scale)
    const m: Measurement = {
      id: uid(), type: tool as MeasType, points: [...curPts],
      value, unit, label: '', color: nextColor(),
    }
    const next = [...measurements, m]
    setMeasurements(next)
    setCurPts([])
    scheduleSave(next)
  }

  function removeMeasurement(id: string) {
    const next = measurements.filter(m => m.id !== id)
    setMeasurements(next)
    scheduleSave(next)
  }

  function updateLabel(id: string, label: string) {
    const next = measurements.map(m => m.id === id ? { ...m, label } : m)
    setMeasurements(next)
    scheduleSave(next)
  }

  function scheduleSave(ms: Measurement[], sc?: Scale | null) {
    if (!activePlanId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(ms, sc !== undefined ? sc : scale), 1200)
  }

  async function doSave(ms: Measurement[], sc: Scale | null) {
    if (!activePlanId) return
    setSaving(true)
    await fetch(`/api/takeoffs/${takeoffId}/plans/${activePlanId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ measurements: JSON.stringify(ms), scale: sc ? JSON.stringify(sc) : null }),
    })
    setSaving(false)
  }

  function confirmScale() {
    const rd = parseFloat(scaleReal)
    if (!rd || scalePts.length < 2) return
    const pd = dist(scalePts[0], scalePts[1])
    const ns: Scale = { p1: scalePts[0], p2: scalePts[1], pixelDist: pd, realDist: rd, unit: scaleUnit }
    setScale(ns); setScalePts([]); setShowScaleDlg(false); setTool('pan')
    scheduleSave(measurements, ns)
  }

  async function renderPdfPages(file: File): Promise<{ name: string; imageData: string }[]> {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const results: { name: string; imageData: string }[] = []
    const MAX_PAGES = 20
    const total = Math.min(pdf.numPages, MAX_PAGES)
    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx as CanvasRenderingContext2D, viewport, canvas }).promise
      const pageLabel = total === 1
        ? file.name.replace(/\.pdf$/i, '')
        : `${file.name.replace(/\.pdf$/i, '')} — Page ${i}`
      results.push({ name: pageLabel, imageData: canvas.toDataURL('image/png') })
    }
    return results
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) { alert('Please upload an image (JPG, PNG) or PDF file'); return }
    setUploading(true)
    try {
      const pages = isPdf
        ? await renderPdfPages(file)
        : await new Promise<{ name: string; imageData: string }[]>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = ev => resolve([{ name: file.name, imageData: ev.target?.result as string }])
            reader.onerror = reject
            reader.readAsDataURL(file)
          })

      let lastPlanId: string | null = null
      for (const page of pages) {
        const res = await fetch(`/api/takeoffs/${takeoffId}/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: page.name, imageData: page.imageData }),
        })
        if (res.ok) {
          const plan: Plan & { imageData: string } = await res.json()
          const parsed: ParsedPlan = { ...plan, parsedScale: null, parsedMeasurements: [] }
          setPlans(prev => [...prev, parsed])
          lastPlanId = plan.id
        }
      }
      if (lastPlanId) setActivePlanId(lastPlanId)
    } catch (err) {
      alert('Failed to process file. Please try again.')
      console.error(err)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this plan and all its measurements?')) return
    await fetch(`/api/takeoffs/${takeoffId}/plans/${id}`, { method: 'DELETE' })
    const remaining = plans.filter(p => p.id !== id)
    setPlans(remaining)
    if (activePlanId === id) setActivePlanId(remaining[0]?.id ?? null)
  }

  function openAddDlg(m: Measurement) {
    setAddDlg(m)
    setAddSection(sections[0] ?? '')
    setAddLabel(m.label || (m.type === 'count' ? 'Items' : m.type === 'linear' ? 'Length' : 'Area'))
  }

  function confirmAdd() {
    if (!addDlg) return
    const qty = addDlg.type === 'count' ? addDlg.value : parseFloat(addDlg.value.toFixed(3))
    const unit = addDlg.type === 'count' ? 'ea' : addDlg.unit
    onAddToTakeoff(addSection, addLabel, qty, unit)
    const next = measurements.map(m => m.id === addDlg.id ? { ...m, addedToTakeoff: true, label: addLabel || m.label } : m)
    setMeasurements(next)
    scheduleSave(next)
    setAddDlg(null)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'Escape') { setCurPts([]); setScalePts([]); setShowScaleDlg(false) }
      if (e.key === 'Enter' && curPts.length >= (tool === 'count' ? 1 : 2)) finishMeasurement()
      if (e.key === 'v' || e.key === 'V') setTool('pan')
      if (e.key === 's' || e.key === 'S') setTool('scale')
      if (e.key === 'c' || e.key === 'C') setTool('count')
      if (e.key === 'l' || e.key === 'L') setTool('linear')
      if (e.key === 'a' || e.key === 'A') setTool('area')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [curPts, tool])

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string, shortcut: string) => (
    <button
      onClick={() => { setTool(t); setCurPts([]) }}
      title={`${label} (${shortcut})`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        tool === t
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="hidden sm:inline text-[10px] opacity-60 font-normal ml-0.5">{shortcut}</span>
    </button>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading plans…
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex items-center gap-3 flex-wrap">
        {/* Plan selector */}
        <div className="flex items-center gap-2">
          {plans.length > 0 && (
            <select
              value={activePlanId ?? ''}
              onChange={e => setActivePlanId(e.target.value || null)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white max-w-[200px]"
            >
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <label className="cursor-pointer">
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="sr-only" onChange={handleUpload} />
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              uploading ? 'bg-slate-100 text-slate-400' : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading…' : 'Upload Plan (JPG / PDF)'}
            </span>
          </label>
          {activePlan && (
            <button onClick={() => deletePlan(activePlan.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors" title="Delete this plan">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activePlan && (
          <>
            <div className="w-px h-6 bg-slate-200" />
            {/* Drawing tools */}
            {toolBtn('pan', <Move className="w-3.5 h-3.5" />, 'Pan', 'V')}
            {toolBtn('scale', <Ruler className="w-3.5 h-3.5" />, 'Set Scale', 'S')}
            {toolBtn('count', <Hash className="w-3.5 h-3.5" />, 'Count', 'C')}
            {toolBtn('linear', <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 14 L14 2"/></svg>, 'Linear', 'L')}
            {toolBtn('area', <Square className="w-3.5 h-3.5" />, 'Area', 'A')}

            <div className="w-px h-6 bg-slate-200" />

            {/* Scale badge */}
            {scale ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                <Check className="w-3 h-3" /> 1:{Math.round(scale.pixelDist / scale.realDist)} scale set
              </span>
            ) : (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                No scale — set scale for real measurements
              </span>
            )}

            {curPts.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-500">{curPts.length} point{curPts.length !== 1 ? 's' : ''} — Enter or double-click to finish, Esc to cancel</span>
                <button onClick={finishMeasurement} className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors">
                  <Check className="w-3 h-3" /> Finish
                </button>
                <button onClick={() => setCurPts([])} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            )}

            {saving && <span className="text-xs text-slate-400 ml-auto flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
          </>
        )}
      </div>

      {/* Canvas + Measurements panel */}
      <div className="flex gap-4" style={{ height: '560px' }}>
        {/* Canvas */}
        <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative">
          {!activePlan ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No plan loaded</p>
              <p className="text-xs mt-1">Upload a JPG, PNG, or PDF plan</p>
              <label className="mt-4 cursor-pointer">
                <input type="file" accept="image/*,.pdf" className="sr-only" onChange={handleUpload} />
                <span className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium px-4 py-2 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                  <Upload className="w-4 h-4" /> Upload Plan
                </span>
              </label>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className={`w-full h-full ${tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              style={{ userSelect: 'none' }}
            />
          )}
        </div>

        {/* Measurements panel */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Measurements</p>
            <p className="text-xs text-slate-400 mt-0.5">{measurements.length} taken</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {measurements.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8 px-4">
                Use the tools above to take measurements on the plan
              </p>
            )}
            {measurements.map(m => (
              <div key={m.id} className={`px-4 py-3 group ${m.addedToTakeoff ? 'bg-emerald-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: m.color }} />
                    <div className="min-w-0">
                      <input
                        type="text"
                        value={m.label}
                        onChange={e => updateLabel(m.id, e.target.value)}
                        placeholder="Label…"
                        className="text-xs font-medium text-slate-800 bg-transparent border-0 outline-none w-full focus:bg-slate-100 focus:rounded px-1 -ml-1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="capitalize">{m.type}</span> · {fmtVal(m)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => removeMeasurement(m.id)}
                      className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {m.addedToTakeoff ? (
                  <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1"><Check className="w-3 h-3" /> Added to takeoff</p>
                ) : (
                  <button
                    onClick={() => openAddDlg(m)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg py-1 font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add to Takeoff
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scale dialog */}
      {showScaleDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-slate-900 mb-1">Set Scale</h3>
            <p className="text-sm text-slate-500 mb-4">
              You drew a line of {scalePts.length === 2 ? Math.round(dist(scalePts[0], scalePts[1])) : '?'} pixels. What is the real-world distance?
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                value={scaleReal}
                onChange={e => setScaleReal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmScale() }}
                placeholder="e.g. 5"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <select
                value={scaleUnit}
                onChange={e => setScaleUnit(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {['mm', 'cm', 'm', 'in', 'ft'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmScale} disabled={!scaleReal} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                Set Scale
              </button>
              <button onClick={() => { setShowScaleDlg(false); setScalePts([]) }} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Takeoff dialog */}
      {addDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-slate-900 mb-1">Add to Takeoff</h3>
            <p className="text-sm text-slate-500 mb-4">{fmtVal(addDlg)}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Section</label>
                {sections.length > 0 ? (
                  <select
                    value={addSection}
                    onChange={e => setAddSection(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={addSection}
                    onChange={e => setAddSection(e.target.value)}
                    placeholder="e.g. Concrete, Labour…"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={e => setAddLabel(e.target.value)}
                  placeholder="Item description…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium">Qty:</span>
                <span>{addDlg.type === 'count' ? addDlg.value : addDlg.value.toFixed(3)}</span>
                <span className="text-slate-400">{addDlg.type === 'count' ? 'ea' : addDlg.unit}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={confirmAdd}
                disabled={!addSection}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                Add to Takeoff
              </button>
              <button onClick={() => setAddDlg(null)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
