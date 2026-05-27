'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarDays, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import AppointmentModal, { type Lead, type Appointment, type ScheduleUser, fmtTime } from './AppointmentModal'
import ScheduleView from './ScheduleView'

interface GCalEvent {
  id: string
  summary: string
  start: string
  end: string
  allDay: boolean
  htmlLink?: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = first.getDay()
  const startOffset = startDow === 0 ? 6 : startDow - 1
  const endDow = last.getDay()
  const endOffset = endDow === 0 ? 0 : 7 - endDow
  const start = new Date(first); start.setDate(start.getDate() - startOffset)
  const end = new Date(last); end.setDate(end.getDate() + endOffset)
  const days: Date[] = []
  const cur = new Date(start)
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
  return days
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ─── Calendar View ────────────────────────────────────────────────────────────
export default function CalendarView({ gcalConnected, accountId }: { gcalConnected: boolean; accountId: string | null }) {
  const today = new Date()
  const [viewMode, setViewMode] = useState<'month' | 'schedule'>(() => {
    if (typeof window === 'undefined') return 'month'
    return (localStorage.getItem('cal-view') as 'month' | 'schedule') ?? 'month'
  })
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<ScheduleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; appt?: Appointment | null; defaultDate?: Date }>({ open: false })

  const days = getCalendarDays(year, month)
  const calFrom = days[0]
  const calTo = days[days.length - 1]

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    const from = calFrom.toISOString()
    const to = new Date(calTo.getFullYear(), calTo.getMonth(), calTo.getDate(), 23, 59, 59).toISOString()
    try {
      const acctQs = accountId ? `&account=${accountId}` : ''
      const [apptRes, gcalRes] = await Promise.all([
        fetch(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${acctQs}`),
        gcalConnected ? fetch(`/api/calendar/gcal-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${acctQs}`) : Promise.resolve(null),
      ])
      if (apptRes.ok) setAppointments(await apptRes.json())
      if (gcalRes?.ok) setGcalEvents(await gcalRes.json())
    } catch (e) {
      console.error('Calendar fetch error:', e)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, gcalConnected, accountId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  useEffect(() => {
    fetch('/api/leads?_all=1').then((r) => r.ok ? r.json() : []).then((d) => {
      if (Array.isArray(d)) setLeads(d.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const acctQs = accountId ? `?account=${accountId}` : ''
    fetch(`/api/users${acctQs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data.map((u: { id: string; name: string | null; email: string }) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          })))
        }
      })
      .catch(() => {})
  }, [accountId])

  function changeView(v: 'month' | 'schedule') {
    localStorage.setItem('cal-view', v)
    setViewMode(v)
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  function openCreate(day: Date) { setModal({ open: true, appt: null, defaultDate: day }) }
  function openEdit(appt: Appointment) { setModal({ open: true, appt }) }

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

  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {viewMode === 'month' && (
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h1 className="text-xl font-bold text-slate-900 w-44 text-center">
                {MONTHS[month]} {year}
              </h1>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {viewMode === 'month' && (
            <button onClick={goToday} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
              Today
            </button>
          )}
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => changeView('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => changeView('schedule')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'schedule' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Schedule
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {gcalConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                CRM appointments
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                Google Calendar
              </div>
            </div>
          ) : (
            <Link href="/settings?tab=integrations" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
              <CalendarDays className="w-3.5 h-3.5" />
              Connect Google Calendar
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          <button
            onClick={() => setModal({ open: true, appt: null, defaultDate: today })}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </div>

      {/* Schedule view */}
      {viewMode === 'schedule' ? (
        <ScheduleView users={users} leads={leads} accountId={accountId} />
      ) : (
        <>
          {/* Calendar grid */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <div>
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-0 min-h-[72px] sm:min-h-[120px]">
                    {week.map((day) => {
                      const isCurrentMonth = day.getMonth() === month
                      const isToday = sameDay(day, today)
                      const dayAppts = appointments.filter((a) => sameDay(new Date(a.startTime), day))
                      const dayGcal = gcalEvents.filter((e) => sameDay(new Date(e.start), day))
                      const allItems = dayAppts.length + dayGcal.length
                      const maxVisible = 3
                      const overflow = allItems > maxVisible
                      const visibleAppts = dayAppts.slice(0, maxVisible)
                      const visibleGcal = dayGcal.slice(0, Math.max(0, maxVisible - visibleAppts.length))

                      return (
                        <div
                          key={day.toISOString()}
                          onClick={() => openCreate(day)}
                          className={`p-2 border-r border-slate-100 last:border-r-0 cursor-pointer hover:bg-slate-50 transition-colors ${!isCurrentMonth ? 'bg-slate-50/50' : ''}`}
                        >
                          <div className="flex justify-end mb-1">
                            <span className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full ${
                              isToday ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                            }`}>
                              {day.getDate()}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            {visibleAppts.map((appt) => (
                              <button
                                key={appt.id}
                                onClick={(e) => { e.stopPropagation(); openEdit(appt) }}
                                className="w-full text-left flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 transition-colors"
                              >
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0" />
                                <span className="text-xs truncate leading-tight">
                                  {!appt.allDay && <span className="font-medium mr-1">{fmtTime(appt.startTime)}</span>}
                                  {appt.title}
                                </span>
                              </button>
                            ))}
                            {visibleGcal.map((ev) => (
                              <a
                                key={ev.id}
                                href={ev.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-left flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 transition-colors"
                              >
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
                                <span className="text-xs truncate leading-tight">
                                  {!ev.allDay && <span className="font-medium mr-1">{fmtTime(ev.start)}</span>}
                                  {ev.summary}
                                </span>
                              </a>
                            ))}
                            {overflow && (
                              <p className="text-xs text-slate-400 pl-1">+{allItems - maxVisible} more</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {modal.open && (
        <AppointmentModal
          initial={modal.appt}
          defaultDate={modal.defaultDate}
          leads={leads}
          users={users}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
