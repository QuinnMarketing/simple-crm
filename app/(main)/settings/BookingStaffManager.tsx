'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, ChevronDown, Check, Clock } from 'lucide-react'

type DayConfig = { enabled: boolean; start: string; end: string }
const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
]
const DEFAULT_DAY: DayConfig = { enabled: false, start: '09:00', end: '17:00' }

type Service = { id: string; name: string }
type Staff = {
  userId: string
  name: string | null
  email: string
  bookable: boolean
  availableHours: string
  serviceIds: string[]
}

export default function BookingStaffManager({ accountId }: { accountId: string | null }) {
  const qs = accountId ? `?account=${accountId}` : ''
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [sRes, tRes] = await Promise.all([
      fetch(`/api/booking-staff${qs}`),
      fetch(`/api/booking-types${qs}`),
    ])
    if (sRes.ok) setStaff((await sRes.json()).staff)
    if (tRes.ok) setServices((await tRes.json()).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))
    setLoading(false)
  }, [qs])

  useEffect(() => { load() }, [load])

  function update(userId: string, patch: Partial<Staff>) {
    setStaff((prev) => prev.map((s) => s.userId === userId ? { ...s, ...patch } : s))
  }

  function parseHours(raw: string): Record<string, DayConfig> {
    try { return JSON.parse(raw) } catch { return {} }
  }
  const usesCustomHours = (s: Staff) => Object.keys(parseHours(s.availableHours)).length > 0

  function setDay(s: Staff, key: string, patch: Partial<DayConfig>) {
    const hours = parseHours(s.availableHours)
    hours[key] = { ...(hours[key] ?? DEFAULT_DAY), ...patch }
    update(s.userId, { availableHours: JSON.stringify(hours) })
  }

  async function save(s: Staff) {
    setSavingId(s.userId)
    await fetch(`/api/booking-staff${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: s.userId, bookable: s.bookable, availableHours: s.availableHours, serviceIds: s.serviceIds }),
    })
    setSavingId(null)
  }

  if (loading) {
    return <div className="flex items-center py-4 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading team…</div>
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-3">
        Choose which team members take online bookings, the services they offer and their working hours.
        Leave everyone unbookable to keep a single shared calendar (services then use business hours).
      </p>

      {services.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Add services under Booking Services first, then assign them to staff here.
        </p>
      )}

      <div className="space-y-2">
        {staff.map((s) => {
          const open = openId === s.userId
          const custom = usesCustomHours(s)
          return (
            <div key={s.userId} className={`rounded-xl border ${s.bookable ? 'border-indigo-200' : 'border-slate-200'}`}>
              <button
                onClick={() => setOpenId(open ? null : s.userId)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{s.name || s.email}</p>
                  <p className="text-xs text-slate-400">
                    {s.bookable ? `${s.serviceIds.length} service${s.serviceIds.length === 1 ? '' : 's'} · ${custom ? 'custom hours' : 'business hours'}` : 'Not taking online bookings'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bookable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.bookable ? 'Bookable' : 'Off'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={s.bookable} onChange={(e) => update(s.userId, { bookable: e.target.checked })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Accepts online bookings
                  </label>

                  {s.bookable && (
                    <>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1.5">Services offered</p>
                        <div className="flex flex-wrap gap-2">
                          {services.map((sv) => {
                            const on = s.serviceIds.includes(sv.id)
                            return (
                              <button
                                key={sv.id}
                                onClick={() => update(s.userId, { serviceIds: on ? s.serviceIds.filter((x) => x !== sv.id) : [...s.serviceIds, sv.id] })}
                                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                              >
                                {on && <Check className="w-3 h-3" />}{sv.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={custom}
                            onChange={(e) => update(s.userId, { availableHours: e.target.checked ? JSON.stringify({ mon: { enabled: true, start: '09:00', end: '17:00' } }) : '{}' })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Custom working hours (otherwise uses business hours)
                        </label>
                        {custom && (
                          <div className="space-y-1.5 pl-1">
                            {DAYS.map(({ key, label }) => {
                              const day = parseHours(s.availableHours)[key] ?? DEFAULT_DAY
                              return (
                                <div key={key} className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 w-16">
                                    <input type="checkbox" checked={day.enabled} onChange={(e) => setDay(s, key, { enabled: e.target.checked })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className={`text-xs ${day.enabled ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
                                  </label>
                                  {day.enabled ? (
                                    <>
                                      <input type="time" value={day.start} onChange={(e) => setDay(s, key, { start: e.target.value })} className="px-2 py-1 border border-slate-300 rounded text-xs" />
                                      <span className="text-slate-400 text-xs">–</span>
                                      <input type="time" value={day.end} onChange={(e) => setDay(s, key, { end: e.target.value })} className="px-2 py-1 border border-slate-300 rounded text-xs" />
                                    </>
                                  ) : <span className="text-xs text-slate-400">Off</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => save(s)}
                    disabled={savingId === s.userId}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {savingId === s.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
