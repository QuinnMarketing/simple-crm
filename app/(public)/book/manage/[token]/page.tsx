'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, Loader2, CheckCircle2, XCircle, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

type Booking = {
  business: string
  service: string | null
  when: string
  status: string
  cancellationHours: number
  policyText: string | null
  canCancel: boolean
  canReschedule: boolean
  accountSlug: string | null
  bookingTypeId: string | null
  staffId: string | null
  timezone: string
  alreadyCancelled?: boolean
  rescheduled?: boolean
}

function ymNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function ymShift(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function ymLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}
function dateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export default function ManageBookingPage() {
  const { token } = useParams<{ token: string }>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  // reschedule state
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const [month, setMonth] = useState(ymNow())
  const [dates, setDates] = useState<string[]>([])
  const [datesLoading, setDatesLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedTime, setSelectedTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/book/manage/${token}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return }
        setBooking(await r.json())
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const availUrl = useCallback((qs: string) => {
    if (!booking?.accountSlug) return null
    const type = booking.bookingTypeId ? `&type=${booking.bookingTypeId}` : ''
    const staff = booking.staffId ? `&staff=${booking.staffId}` : ''
    return `/api/book/${booking.accountSlug}/availability?${qs}${type}${staff}`
  }, [booking])

  const loadDates = useCallback(async (ym: string) => {
    const url = availUrl(`month=${ym}`)
    if (!url) return
    setDatesLoading(true)
    try {
      const r = await fetch(url)
      const d = await r.json()
      setDates(Array.isArray(d.dates) ? d.dates : [])
    } catch { setDates([]) } finally { setDatesLoading(false) }
  }, [availUrl])

  async function openReschedule() {
    setMode('reschedule')
    setError('')
    setSelectedDate(''); setSelectedTime(''); setSlots([])
    const ym = ymNow()
    setMonth(ym)
    await loadDates(ym)
  }

  async function changeMonth(delta: number) {
    const ym = ymShift(month, delta)
    setMonth(ym); setSelectedDate(''); setSelectedTime(''); setSlots([])
    await loadDates(ym)
  }

  async function selectDate(date: string) {
    setSelectedDate(date); setSelectedTime(''); setSlots([])
    const url = availUrl(`date=${date}`)
    if (!url) return
    setSlotsLoading(true)
    try {
      const r = await fetch(url)
      const d = await r.json()
      setSlots(Array.isArray(d.slots) ? d.slots : [])
    } catch { setSlots([]) } finally { setSlotsLoading(false) }
  }

  async function submitReschedule() {
    if (!selectedDate || !selectedTime) return
    setSubmitting(true); setError('')
    try {
      const r = await fetch(`/api/book/manage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', date: selectedDate, time: selectedTime }),
      })
      const data = await r.json()
      if (r.ok) { setBooking(data); setMode('view') }
      else setError(data.error ?? 'Could not reschedule — please try another time.')
    } finally { setSubmitting(false) }
  }

  async function cancel() {
    if (!confirm('Cancel this booking? This cannot be undone.')) return
    setCancelling(true); setError('')
    const r = await fetch(`/api/book/manage/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    const data = await r.json()
    if (r.ok) setBooking(data)
    else setError(data.error ?? 'Could not cancel — please contact the business.')
    setCancelling(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
  }
  if (notFound || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <p className="text-slate-500 text-lg font-medium">Booking not found.</p>
      </div>
    )
  }

  const cancelled = booking.status === 'cancelled'

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 px-6 py-5">
          <h1 className="text-white font-bold text-lg">Your booking</h1>
          <p className="text-indigo-200 text-sm mt-0.5">{booking.business}</p>
        </div>
        <div className="p-6">
          {mode === 'view' ? (
            <>
              {cancelled ? (
                <div className="flex items-center gap-2 mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <XCircle className="w-4 h-4" /> This booking is cancelled
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> {booking.rescheduled ? 'Rescheduled — confirmed' : 'Confirmed'}
                </div>
              )}

              <div className="space-y-1 mb-5">
                {booking.service && <p className="font-semibold text-slate-900">{booking.service}</p>}
                <p className="text-slate-700 text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-slate-400" />{booking.when}</p>
              </div>

              {booking.policyText && (
                <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">{booking.policyText}</div>
              )}

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              {!cancelled && booking.canReschedule && (
                <button
                  onClick={openReschedule}
                  className="w-full py-2.5 mb-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
                >
                  Reschedule booking
                </button>
              )}
              {!cancelled && booking.canCancel && (
                <button
                  onClick={cancel}
                  disabled={cancelling}
                  className="w-full py-2.5 rounded-lg border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Cancel booking
                </button>
              )}
              {!cancelled && !booking.canCancel && !booking.canReschedule && (
                <p className="text-xs text-slate-400 text-center">
                  {booking.cancellationHours > 0
                    ? `Bookings can only be changed online up to ${booking.cancellationHours} hours before the appointment. Please contact ${booking.business} directly.`
                    : `Please contact ${booking.business} directly to make changes.`}
                </p>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setMode('view'); setError('') }} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <p className="text-sm font-semibold text-slate-900 mb-1">Pick a new time</p>
              <p className="text-xs text-slate-500 mb-4">Currently: {booking.when}</p>

              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => changeMonth(-1)} disabled={month <= ymNow()} className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-medium text-slate-700">{ymLabel(month)}</span>
                <button onClick={() => changeMonth(1)} className="p-1.5 rounded-md hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
              </div>

              {/* Dates */}
              {datesLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
              ) : dates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No open dates this month.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
                  {dates.map((d) => (
                    <button
                      key={d}
                      onClick={() => selectDate(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedDate === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}
                    >
                      {dateLabel(d)}
                    </button>
                  ))}
                </div>
              )}

              {/* Slots */}
              {selectedDate && (
                slotsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No times available on this day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {slots.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedTime === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}
                      >
                        {timeLabel(t)}
                      </button>
                    ))}
                  </div>
                )
              )}

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <button
                onClick={submitReschedule}
                disabled={!selectedDate || !selectedTime || submitting}
                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {selectedTime ? `Confirm ${dateLabel(selectedDate)}, ${timeLabel(selectedTime)}` : 'Confirm new time'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
