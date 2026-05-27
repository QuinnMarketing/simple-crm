'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import AppointmentModal, { type Lead, type Appointment, type ScheduleUser, fmtTime } from './AppointmentModal'

const USER_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-400', drag: 'bg-violet-200', border: 'border-violet-300' },
  { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-400', drag: 'bg-sky-200', border: 'border-sky-300' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-400', drag: 'bg-emerald-200', border: 'border-emerald-300' },
  { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400', drag: 'bg-amber-200', border: 'border-amber-300' },
  { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-400', drag: 'bg-rose-200', border: 'border-rose-300' },
  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400', drag: 'bg-orange-200', border: 'border-orange-300' },
  { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-400', drag: 'bg-teal-200', border: 'border-teal-300' },
  { bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-400', drag: 'bg-pink-200', border: 'border-pink-300' },
]
const UNASSIGNED = { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-300', drag: 'bg-slate-200', border: 'border-slate-300' }

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const UNASSIGNED_ID = '__unassigned__'

// Day-view grid constants
const HOUR_H = 60        // px per hour — 30 min = 30px, 1 hr = 60px, 2 hr = 120px
const START_H = 7        // 7 am
const END_H = 21         // 9 pm (exclusive)
const SNAP = 15          // snap to 15-minute intervals
const TOTAL_H = (END_H - START_H) * HOUR_H
const GRID_HOURS = Array.from({ length: END_H - START_H }, (_, i) => i + START_H)
const MIN_DISPLAY_H = 28 // minimum px height for any appointment chip

type DragCreate = { userId: string; startMins: number; currentMins: number }
type DragMove = {
  appt: Appointment
  currentUserId: string
  offsetMins: number       // cursor offset from appointment start
  currentStartMins: number
  active: boolean          // true once moved past the 5px threshold
}

function getWeekStart(d: Date): Date {
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() + offset)
  return s
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtShort(d: Date) {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function fmtHour(h: number) {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

// Format offset-minutes-from-START_H as a human time string
function fmtMins(offsetMins: number): string {
  const clamped = Math.max(0, Math.min((END_H - START_H) * 60, offsetMins))
  const absH = START_H + Math.floor(clamped / 60)
  const m = clamped % 60
  const h12 = absH === 0 ? 12 : absH > 12 ? absH - 12 : absH
  const suffix = absH < 12 ? 'am' : 'pm'
  return m > 0 ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`
}

function snapTo(raw: number): number {
  return Math.round(raw / SNAP) * SNAP
}

function clampMins(m: number): number {
  return Math.max(0, Math.min((END_H - START_H) * 60, m))
}

function minsToY(mins: number): number {
  return (mins / 60) * HOUR_H
}

function yToMins(y: number): number {
  return clampMins(snapTo((y / HOUR_H) * 60))
}

function timeToOffsetMins(date: Date): number {
  return (date.getHours() - START_H) * 60 + date.getMinutes()
}

interface Props {
  users: ScheduleUser[]
  leads: Lead[]
  accountId: string | null
}

export default function ScheduleView({ users, leads, accountId }: Props) {
  const today = new Date()

  const [layout, setLayout] = useState<'horizontal' | 'vertical'>(() => {
    if (typeof window === 'undefined') return 'horizontal'
    return (localStorage.getItem('schedule-layout') as 'horizontal' | 'vertical') ?? 'horizontal'
  })
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
  const [day, setDay] = useState(() => { const d = new Date(today); d.setHours(0, 0, 0, 0); return d })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{
    open: boolean
    appt?: Appointment | null
    defaultDate?: Date
    defaultEndTime?: Date
    defaultUserId?: string
  }>({ open: false })

  const [dragCreate, setDragCreate] = useState<DragCreate | null>(null)
  const [dragMove, setDragMove] = useState<DragMove | null>(null)

  const bodyRef = useRef<HTMLDivElement>(null)
  const mouseDownY = useRef(0)
  // Keep refs in sync so the global mouseup handler can read latest values
  const dragCreateRef = useRef(dragCreate)
  const dragMoveRef = useRef(dragMove)
  const dayRef = useRef(day)
  const usersRef = useRef(users)
  useEffect(() => { dragCreateRef.current = dragCreate }, [dragCreate])
  useEffect(() => { dragMoveRef.current = dragMove }, [dragMove])
  useEffect(() => { dayRef.current = day }, [day])
  useEffect(() => { usersRef.current = users }, [users])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let from: string, to: string
      if (layout === 'horizontal') {
        from = weekStart.toISOString()
        const last = addDays(weekStart, 6)
        to = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59).toISOString()
      } else {
        from = day.toISOString()
        to = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59).toISOString()
      }
      const acctQs = accountId ? `&account=${accountId}` : ''
      const res = await fetch(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${acctQs}`)
      if (res.ok) setAppointments(await res.json())
    } catch (e) {
      console.error('Schedule fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [layout, weekStart, day, accountId])

  useEffect(() => { fetchData() }, [fetchData])

  // Global mouseup — cancel any stuck drag if user releases outside the component
  useEffect(() => {
    function handleGlobalMouseUp() {
      const dc = dragCreateRef.current
      const dm = dragMoveRef.current
      if (!dc && !dm) return
      if (dc) commitDragCreate(dc, dayRef.current)
      if (dm && dm.active) commitDragMove(dm, dayRef.current, usersRef.current)
      setDragCreate(null)
      setDragMove(null)
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Pure helpers (no state, can be called from global handler) ──────────

  function commitDragCreate(dc: DragCreate, forDay: Date) {
    const selStart = Math.min(dc.startMins, dc.currentMins)
    const selEnd = Math.max(dc.startMins, dc.currentMins)
    const endMins = selEnd + SNAP  // end is one snap past where you stopped
    const startH = START_H + Math.floor(selStart / 60)
    const startM = selStart % 60
    const endH = START_H + Math.floor(endMins / 60)
    const endM = endMins % 60
    const startDate = new Date(forDay.getFullYear(), forDay.getMonth(), forDay.getDate(), startH, startM, 0)
    const endDate = new Date(forDay.getFullYear(), forDay.getMonth(), forDay.getDate(), endH, endM, 0)
    setModal({
      open: true, appt: null,
      defaultDate: startDate,
      defaultEndTime: endDate,
      defaultUserId: dc.userId === UNASSIGNED_ID ? undefined : dc.userId,
    })
  }

  function commitDragMove(dm: DragMove, forDay: Date, currentUsers: ScheduleUser[]) {
    const appt = dm.appt
    const durationMs = new Date(appt.endTime).getTime() - new Date(appt.startTime).getTime()
    const startH = START_H + Math.floor(dm.currentStartMins / 60)
    const startM = dm.currentStartMins % 60
    const newStart = new Date(forDay.getFullYear(), forDay.getMonth(), forDay.getDate(), startH, startM, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)
    const newUserId = dm.currentUserId === UNASSIGNED_ID ? null : dm.currentUserId

    setAppointments(prev => prev.map(a => a.id === appt.id ? {
      ...a,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      userId: newUserId,
      assignedTo: newUserId
        ? (currentUsers.find(u => u.id === newUserId)
            ? { id: newUserId, name: currentUsers.find(u => u.id === newUserId)!.name }
            : null)
        : null,
    } : a))

    fetch(`/api/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime: newStart.toISOString(), endTime: newEnd.toISOString(), userId: newUserId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(updated => { if (updated) setAppointments(prev => prev.map(a => a.id === appt.id ? updated : a)) })
      .catch(console.error)
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function getBodyY(clientY: number): number {
    return clientY - (bodyRef.current?.getBoundingClientRect().top ?? 0)
  }

  function handleColMouseDown(e: React.MouseEvent, colId: string) {
    if (e.button !== 0) return
    // If a drag is stuck (released outside), clear it
    if (dragCreate || dragMove) { setDragCreate(null); setDragMove(null); return }
    e.preventDefault()
    const mins = yToMins(getBodyY(e.clientY))
    setDragCreate({ userId: colId, startMins: mins, currentMins: mins })
  }

  function handleApptMouseDown(e: React.MouseEvent, appt: Appointment, colId: string) {
    e.stopPropagation()
    if (e.button !== 0) return
    e.preventDefault()
    mouseDownY.current = e.clientY
    const startMins = timeToOffsetMins(new Date(appt.startTime))
    const clickMins = yToMins(getBodyY(e.clientY))
    const offsetMins = Math.max(0, clickMins - startMins)
    setDragMove({ appt, currentUserId: colId, offsetMins, currentStartMins: startMins, active: false })
  }

  function handleMouseMove(e: React.MouseEvent) {
    const mins = yToMins(getBodyY(e.clientY))

    if (dragCreate) {
      setDragCreate(d => d ? { ...d, currentMins: mins } : null)
    }
    if (dragMove) {
      // Only activate once cursor has moved > 5px to distinguish click from drag
      const movedEnough = Math.abs(e.clientY - mouseDownY.current) > 5
      if (movedEnough) {
        const newStart = clampMins(snapTo(mins - dragMove.offsetMins))
        setDragMove(d => d ? { ...d, currentStartMins: newStart, active: true } : null)
      }
    }
  }

  function handleMouseUp() {
    if (dragCreate) {
      const dc = dragCreate
      setDragCreate(null)
      commitDragCreate(dc, day)
      return
    }
    if (dragMove) {
      const dm = dragMove
      setDragMove(null)
      if (!dm.active) {
        // Treat as a click — open the edit modal
        setModal({ open: true, appt: dm.appt })
      } else {
        commitDragMove(dm, day, users)
      }
    }
  }

  function handleSave(appt: Appointment) {
    setAppointments((prev) => {
      const idx = prev.findIndex((a) => a.id === appt.id)
      return idx >= 0 ? prev.map((a) => a.id === appt.id ? appt : a) : [...prev, appt]
    })
    setModal({ open: false })
  }

  function handleDelete(id: string) {
    setAppointments((prev) => prev.filter((a) => a.id !== id))
    setModal({ open: false })
  }

  function changeLayout(l: 'horizontal' | 'vertical') {
    localStorage.setItem('schedule-layout', l)
    setLayout(l)
    setDragCreate(null)
    setDragMove(null)
  }

  function colorForUserId(uid: string | null | undefined) {
    if (!uid) return UNASSIGNED
    const idx = users.findIndex((u) => u.id === uid)
    return idx >= 0 ? USER_COLORS[idx % USER_COLORS.length] : UNASSIGNED
  }

  function apptUserId(a: Appointment) {
    return a.userId || UNASSIGNED_ID
  }

  // ── Horizontal layout (unchanged) ─────────────────────────────────────────

  const rows = [
    ...users.map((u) => ({ id: u.id, label: u.name || u.email })),
    { id: UNASSIGNED_ID, label: 'Unassigned' },
  ]

  function renderHorizontal() {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[600px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-r border-slate-200 bg-slate-50 min-w-[120px] sticky left-0 z-10">
                Team member
              </th>
              {weekDays.map((d, i) => (
                <th key={i} className={`text-center px-2 py-2 border-b border-r last:border-r-0 border-slate-200 min-w-[110px] ${sameDay(d, today) ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                  <div className={`text-xs uppercase tracking-wide ${sameDay(d, today) ? 'text-indigo-600' : 'text-slate-400'}`}>{WEEKDAY_LABELS[i]}</div>
                  <div className={`text-base font-bold mt-0.5 ${sameDay(d, today) ? 'text-indigo-600' : 'text-slate-700'}`}>{d.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const color = row.id === UNASSIGNED_ID ? UNASSIGNED : colorForUserId(row.id)
              return (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className={`px-3 py-2.5 text-xs font-semibold border-r border-slate-200 sticky left-0 z-10 bg-white ${color.text}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                      {row.label}
                    </div>
                  </td>
                  {weekDays.map((d, di) => {
                    const cellAppts = appointments.filter((a) => sameDay(new Date(a.startTime), d) && apptUserId(a) === row.id)
                    return (
                      <td
                        key={di}
                        onClick={() => setModal({ open: true, appt: null, defaultDate: d, defaultUserId: row.id === UNASSIGNED_ID ? undefined : row.id })}
                        className="px-1.5 py-1.5 border-r last:border-r-0 border-slate-100 align-top min-h-[72px] cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="space-y-1 min-h-[56px]">
                          {cellAppts.map((appt) => (
                            <button
                              key={appt.id}
                              onClick={(e) => { e.stopPropagation(); setModal({ open: true, appt }) }}
                              className={`w-full text-left rounded px-2 py-1 text-xs ${color.bg} ${color.text} hover:brightness-95 transition-all`}
                            >
                              <div className="font-medium truncate">{appt.title}</div>
                              {!appt.allDay && <div className="opacity-60 mt-0.5">{fmtTime(appt.startTime)}</div>}
                              {appt.location && <div className="opacity-50 truncate">{appt.location}</div>}
                            </button>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Vertical / day view with absolute-positioned events ───────────────────

  function renderVertical() {
    const cols = [
      ...users.map((u) => ({ id: u.id, label: u.name || u.email })),
      { id: UNASSIGNED_ID, label: 'Unassigned' },
    ]

    return (
      <div>
        {/* Column headers */}
        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
          <div className="w-14 flex-shrink-0" />
          {cols.map((col) => {
            const color = col.id === UNASSIGNED_ID ? UNASSIGNED : colorForUserId(col.id)
            return (
              <div key={col.id} className={`flex-1 min-w-[140px] px-3 py-2.5 text-xs font-semibold border-l border-slate-100 text-center ${color.text}`}>
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  {col.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Body: time labels + event columns */}
        <div
          ref={bodyRef}
          className={`flex${dragCreate || dragMove?.active ? ' select-none' : ''}`}
          style={{ height: TOTAL_H, cursor: dragMove?.active ? 'grabbing' : undefined }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Time label column */}
          <div className="w-14 flex-shrink-0 relative border-r border-slate-100 bg-white">
            {GRID_HOURS.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 text-xs font-medium text-slate-400 pointer-events-none"
                style={{ top: i * HOUR_H - 8 }}
              >
                {fmtHour(h)}
              </div>
            ))}
          </div>

          {/* One column per user + unassigned */}
          {cols.map((col) => {
            const color = col.id === UNASSIGNED_ID ? UNASSIGNED : colorForUserId(col.id)
            const colAppts = appointments.filter((a) =>
              sameDay(new Date(a.startTime), day) && apptUserId(a) === col.id
            )

            // ── Drag-create preview ──
            const dc = dragCreate?.userId === col.id ? dragCreate : null
            let dcTop = 0, dcHeight = 0, dcLabel = ''
            if (dc) {
              const selStart = Math.min(dc.startMins, dc.currentMins)
              const selEnd = Math.max(dc.startMins, dc.currentMins)
              dcTop = minsToY(selStart)
              dcHeight = Math.max(MIN_DISPLAY_H, minsToY(selEnd - selStart + SNAP))
              dcLabel = `${fmtMins(selStart)} – ${fmtMins(selEnd + SNAP)}`
            }

            // ── Drag-move ghost ──
            const dm = dragMove?.active && dragMove.currentUserId === col.id ? dragMove : null
            let dmTop = 0, dmHeight = 0, dmLabel = ''
            if (dm) {
              const durMins = (new Date(dm.appt.endTime).getTime() - new Date(dm.appt.startTime).getTime()) / 60000
              dmTop = minsToY(dm.currentStartMins)
              dmHeight = Math.max(MIN_DISPLAY_H, minsToY(durMins))
              dmLabel = `${fmtMins(dm.currentStartMins)} – ${fmtMins(dm.currentStartMins + durMins)}`
            }

            return (
              <div
                key={col.id}
                className="flex-1 min-w-[140px] border-l border-slate-100 relative"
                style={{ cursor: dragMove?.active ? 'grabbing' : 'crosshair' }}
                onMouseDown={(e) => handleColMouseDown(e, col.id)}
                onMouseEnter={() => {
                  if (dragMove?.active) setDragMove(d => d ? { ...d, currentUserId: col.id } : null)
                }}
              >
                {/* Hour grid lines */}
                {GRID_HOURS.map((_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-slate-100 pointer-events-none" style={{ top: i * HOUR_H }} />
                ))}
                {/* Half-hour lines */}
                {GRID_HOURS.map((_, i) => (
                  <div key={`h${i}`} className="absolute inset-x-0 border-t border-slate-50 pointer-events-none" style={{ top: i * HOUR_H + HOUR_H / 2 }} />
                ))}

                {/* Drag-create highlight */}
                {dc && (
                  <div
                    className={`absolute inset-x-1 rounded-lg pointer-events-none z-20 ${color.drag} border ${color.border} flex flex-col px-2 py-1 overflow-hidden`}
                    style={{ top: dcTop, height: dcHeight }}
                  >
                    <span className={`text-xs font-semibold leading-tight ${color.text}`}>{dcLabel}</span>
                  </div>
                )}

                {/* Drag-move ghost */}
                {dm && (
                  <div
                    className={`absolute inset-x-1 rounded-lg pointer-events-none z-20 border-2 border-dashed ${color.border} ${color.bg} opacity-80 flex flex-col px-2 py-1 overflow-hidden`}
                    style={{ top: dmTop, height: dmHeight }}
                  >
                    <span className={`text-xs font-semibold truncate leading-tight ${color.text}`}>{dm.appt.title}</span>
                    <span className={`text-xs leading-tight ${color.text} opacity-70`}>{dmLabel}</span>
                  </div>
                )}

                {/* Appointments — absolutely positioned by time */}
                {colAppts.map((appt) => {
                  const startDate = new Date(appt.startTime)
                  const endDate = new Date(appt.endTime)
                  const startMins = timeToOffsetMins(startDate)
                  // Skip appointments entirely outside the visible range
                  if (startMins >= (END_H - START_H) * 60) return null
                  const endMins = timeToOffsetMins(endDate) || (END_H - START_H) * 60
                  const effectiveStart = Math.max(0, startMins)
                  const effectiveEnd = Math.min((END_H - START_H) * 60, endMins > effectiveStart ? endMins : effectiveStart + 60)
                  const top = minsToY(effectiveStart)
                  const height = Math.max(MIN_DISPLAY_H, minsToY(effectiveEnd - effectiveStart))
                  const isBeingMoved = dragMove?.appt.id === appt.id

                  return (
                    <div
                      key={appt.id}
                      style={{ position: 'absolute', top, height, left: 4, right: 4, zIndex: 5 }}
                      className={`rounded-lg px-2 py-1 overflow-hidden transition-opacity ${color.bg} ${color.text} ${
                        isBeingMoved && dragMove?.active ? 'opacity-20 cursor-grabbing' : 'cursor-grab hover:brightness-95 active:cursor-grabbing'
                      }`}
                      onMouseDown={(e) => handleApptMouseDown(e, appt, col.id)}
                    >
                      <div className="text-xs font-semibold leading-tight truncate">{appt.title}</div>
                      {height >= 38 && (
                        <div className="text-xs opacity-70 leading-tight mt-0.5 truncate">
                          {fmtTime(appt.startTime)} – {fmtTime(appt.endTime)}
                        </div>
                      )}
                      {appt.location && height >= 54 && (
                        <div className="text-xs opacity-55 leading-tight mt-0.5 truncate">{appt.location}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Navigation + layout toggle */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        {layout === 'horizontal' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart((s) => addDays(s, -7))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[180px] text-center">
              {fmtShort(weekStart)} – {fmtShort(addDays(weekStart, 6))}
            </span>
            <button onClick={() => setWeekStart((s) => addDays(s, 7))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setWeekStart(getWeekStart(today))} className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
              This week
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setDay((d) => addDays(d, -1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">
              {day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button onClick={() => setDay((d) => addDays(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => { const d = new Date(today); d.setHours(0, 0, 0, 0); setDay(d) }}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Today
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => changeLayout('horizontal')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${layout === 'horizontal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Week grid
          </button>
          <button
            onClick={() => changeLayout('vertical')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${layout === 'vertical' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Day view
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-1">
            <p className="text-sm font-medium">No team members found</p>
            <p className="text-xs">Add users to your account to use the schedule view</p>
          </div>
        ) : layout === 'horizontal' ? renderHorizontal() : renderVertical()}
      </div>

      {/* Legend */}
      {users.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {users.map((u, i) => (
            <div key={u.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`w-2.5 h-2.5 rounded-full ${USER_COLORS[i % USER_COLORS.length].dot}`} />
              {u.name || u.email}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            Unassigned
          </div>
        </div>
      )}

      {modal.open && (
        <AppointmentModal
          initial={modal.appt}
          defaultDate={modal.defaultDate}
          defaultEndTime={modal.defaultEndTime}
          defaultUserId={modal.defaultUserId}
          users={users}
          leads={leads}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
