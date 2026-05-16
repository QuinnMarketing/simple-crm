'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Clock, CalendarDays } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type BookingInfo = {
  title: string
  description: string | null
  slotDuration: number
  timezone: string
}

type Step = 'date' | 'time' | 'form' | 'done'

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BookingPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Calendar state
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState(false)

  // Selection state
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<Step>('date')

  // Initial info load
  useEffect(() => {
    fetch(`/api/book/${slug}/availability`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return }
        const data = await r.json()
        if (data.info) setInfo(data.info)
      })
      .catch(() => setNotFound(true))
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDates = useCallback(async (year: number, month: number) => {
    setLoadingDates(true)
    try {
      const r = await fetch(`/api/book/${slug}/availability?month=${year}-${String(month + 1).padStart(2, '0')}`)
      if (!r.ok) { setNotFound(true); return }
      const data = await r.json()
      if (data.info) setInfo(data.info)
      setAvailableDates(new Set(data.dates ?? []))
    } finally {
      setLoadingDates(false)
    }
  }, [slug])

  useEffect(() => { loadDates(viewYear, viewMonth) }, [viewYear, viewMonth, loadDates])

  async function selectDate(dateStr: string) {
    setSelectedDate(dateStr)
    setSelectedTime(null)
    setLoadingSlots(true)
    setStep('time')
    try {
      const r = await fetch(`/api/book/${slug}/availability?date=${dateStr}`)
      const data = await r.json()
      setSlots(data.slots ?? [])
    } finally {
      setLoadingSlots(false)
    }
  }

  async function submit() {
    if (!selectedDate || !selectedTime || !form.name.trim()) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/book/${slug}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time: selectedTime, ...form }),
      })
      if (r.ok) setStep('done')
    } finally {
      setSubmitting(false)
    }
  }

  // Calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const canPrevMonth = !(viewYear === today.getFullYear() && viewMonth === today.getMonth())

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <p className="text-slate-500 text-lg font-medium">Booking page not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5">
          <h1 className="text-white font-bold text-xl">{info?.title ?? 'Book an Appointment'}</h1>
          {info?.description && <p className="text-indigo-200 text-sm mt-1">{info.description}</p>}
          {info && (
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-indigo-200 text-xs">
                <Clock className="w-3.5 h-3.5" />
                {info.slotDuration} min
              </span>
              <span className="flex items-center gap-1.5 text-indigo-200 text-xs">
                <CalendarDays className="w-3.5 h-3.5" />
                {info.timezone}
              </span>
            </div>
          )}
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex border-b border-slate-100">
            {(['date', 'time', 'form'] as const).map((s, i) => (
              <div key={s} className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${step === s ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>
                {i + 1}. {s === 'date' ? 'Pick a date' : s === 'time' ? 'Pick a time' : 'Your details'}
              </div>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* STEP: date */}
          {step === 'date' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevMonth}
                  disabled={!canPrevMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <span className="font-semibold text-slate-900">{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {SHORT_DAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
                ))}
              </div>

              {loadingDates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfMonth }, (_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isAvailable = availableDates.has(dateStr)
                    const isToday = dateStr === todayStr
                    const isPast = dateStr < todayStr

                    return (
                      <button
                        key={day}
                        disabled={!isAvailable || isPast}
                        onClick={() => selectDate(dateStr)}
                        className={`
                          aspect-square rounded-lg text-sm font-medium transition-colors
                          ${isPast ? 'text-slate-300 cursor-not-allowed' : ''}
                          ${!isPast && !isAvailable ? 'text-slate-400 cursor-not-allowed' : ''}
                          ${isAvailable && !isPast ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white cursor-pointer' : ''}
                          ${isToday && isAvailable ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                        `}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP: time */}
          {step === 'time' && selectedDate && (
            <div>
              <button
                onClick={() => { setStep('date'); setSelectedDate(null) }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <p className="font-semibold text-slate-900 mb-4">{formatDateLong(selectedDate)}</p>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No available times on this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((time) => (
                    <button
                      key={time}
                      onClick={() => { setSelectedTime(time); setStep('form') }}
                      className="py-2.5 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      {formatTime12(time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP: form */}
          {step === 'form' && selectedDate && selectedTime && (
            <div>
              <button
                onClick={() => { setStep('time'); setSelectedTime(null) }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div className="mb-5 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 font-medium">
                {formatDateLong(selectedDate)} at {formatTime12(selectedTime)}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Your full name"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="04xx xxx xxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    placeholder="Anything you'd like us to know…"
                  />
                </div>
                <button
                  onClick={submit}
                  disabled={submitting || !form.name.trim()}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm Booking
                </button>
              </div>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
              {selectedDate && selectedTime && (
                <p className="text-slate-600 text-sm">
                  {formatDateLong(selectedDate)} at {formatTime12(selectedTime)}
                </p>
              )}
              <p className="text-slate-500 text-sm mt-3">
                We&apos;ll be in touch to confirm your appointment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
