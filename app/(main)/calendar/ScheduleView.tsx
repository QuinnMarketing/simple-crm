'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import AppointmentModal, { type Lead, type Appointment, type ScheduleUser, fmtTime } from './AppointmentModal'

const USER_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-400' },
  { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-400' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-400' },
  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-400' },
  { bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-400' },
]
const UNASSIGNED = { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-300' }

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 am – 7 pm
const UNASSIGNED_ID = '__unassigned__'

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
    defaultUserId?: string
  }>({ open: false })

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

  function changeLayout(l: 'horizontal' | 'vertical') {
    localStorage.setItem('schedule-layout', l)
    setLayout(l)
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

  function colorForUserId(uid: string | null | undefined) {
    if (!uid) return UNASSIGNED
    const idx = users.findIndex((u) => u.id === uid)
    return idx >= 0 ? USER_COLORS[idx % USER_COLORS.length] : UNASSIGNED
  }

  function apptUserId(a: Appointment) {
    return a.userId || UNASSIGNED_ID
  }

  const rows = [
    ...users.map((u) => ({ id: u.id, label: u.name || u.email })),
    { id: UNASSIGNED_ID, label: 'Unassigned' },
  ]

  // ─── Horizontal layout: users as rows, weekdays as columns ───────────────
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
                <th
                  key={i}
                  className={`text-center px-2 py-2 border-b border-r last:border-r-0 border-slate-200 min-w-[110px] ${
                    sameDay(d, today) ? 'bg-indigo-50' : 'bg-slate-50'
                  }`}
                >
                  <div className={`text-xs uppercase tracking-wide ${sameDay(d, today) ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {WEEKDAY_LABELS[i]}
                  </div>
                  <div className={`text-base font-bold mt-0.5 ${sameDay(d, today) ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {d.getDate()}
                  </div>
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
                    const cellAppts = appointments.filter(
                      (a) => sameDay(new Date(a.startTime), d) && apptUserId(a) === row.id
                    )
                    return (
                      <td
                        key={di}
                        onClick={() =>
                          setModal({
                            open: true,
                            appt: null,
                            defaultDate: d,
                            defaultUserId: row.id === UNASSIGNED_ID ? undefined : row.id,
                          })
                        }
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
                              {!appt.allDay && (
                                <div className="opacity-60 mt-0.5">{fmtTime(appt.startTime)}</div>
                              )}
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

  // ─── Vertical layout: time slots as rows, users as columns ───────────────
  function renderVertical() {
    const cols = [
      ...users.map((u) => ({ id: u.id, label: u.name || u.email })),
      { id: UNASSIGNED_ID, label: 'Unassigned' },
    ]
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-r border-slate-200 bg-slate-50 w-16 sticky left-0 z-10 text-right">
                Time
              </th>
              {cols.map((col) => {
                const color = col.id === UNASSIGNED_ID ? UNASSIGNED : colorForUserId(col.id)
                return (
                  <th
                    key={col.id}
                    className={`text-center px-3 py-2.5 text-xs font-semibold border-b border-r last:border-r-0 border-slate-200 bg-slate-50 min-w-[150px] ${color.text}`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                      {col.label}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 text-xs text-slate-400 font-medium border-r border-slate-200 text-right align-top pt-2.5 sticky left-0 z-10 bg-white">
                  {fmtHour(hour)}
                </td>
                {cols.map((col) => {
                  const color = col.id === UNASSIGNED_ID ? UNASSIGNED : colorForUserId(col.id)
                  const cellAppts = appointments.filter((a) => {
                    const d = new Date(a.startTime)
                    return sameDay(d, day) && d.getHours() === hour && apptUserId(a) === col.id
                  })
                  const cellDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0)
                  return (
                    <td
                      key={col.id}
                      onClick={() =>
                        setModal({
                          open: true,
                          appt: null,
                          defaultDate: cellDate,
                          defaultUserId: col.id === UNASSIGNED_ID ? undefined : col.id,
                        })
                      }
                      className="px-1.5 py-1.5 border-r last:border-r-0 border-slate-100 align-top h-16 cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="space-y-1">
                        {cellAppts.map((appt) => (
                          <button
                            key={appt.id}
                            onClick={(e) => { e.stopPropagation(); setModal({ open: true, appt }) }}
                            className={`w-full text-left rounded px-2 py-1 text-xs ${color.bg} ${color.text} hover:brightness-95 transition-all`}
                          >
                            <div className="font-medium truncate">{appt.title}</div>
                            <div className="opacity-60 mt-0.5">
                              {fmtTime(appt.startTime)} – {fmtTime(appt.endTime)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      {/* Sub-navigation */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        {layout === 'horizontal' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((s) => addDays(s, -7))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[180px] text-center">
              {fmtShort(weekStart)} – {fmtShort(addDays(weekStart, 6))}
            </span>
            <button
              onClick={() => setWeekStart((s) => addDays(s, 7))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekStart(getWeekStart(today))}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            >
              This week
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDay((d) => addDays(d, -1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">
              {day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button
              onClick={() => setDay((d) => addDays(d, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
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

        {/* Layout toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => changeLayout('horizontal')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              layout === 'horizontal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Week grid
          </button>
          <button
            onClick={() => changeLayout('vertical')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              layout === 'vertical' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
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
          {users.map((u, i) => {
            const color = USER_COLORS[i % USER_COLORS.length]
            return (
              <div key={u.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                {u.name || u.email}
              </div>
            )
          })}
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
