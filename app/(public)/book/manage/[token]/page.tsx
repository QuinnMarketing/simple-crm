'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, Loader2, CheckCircle2, XCircle } from 'lucide-react'

type Booking = {
  business: string
  service: string | null
  when: string
  status: string
  cancellationHours: number
  policyText: string | null
  canCancel: boolean
  alreadyCancelled?: boolean
}

export default function ManageBookingPage() {
  const { token } = useParams<{ token: string }>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/book/manage/${token}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return }
        setBooking(await r.json())
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  async function cancel() {
    if (!confirm('Cancel this booking? This cannot be undone.')) return
    setCancelling(true)
    setError('')
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
          {cancelled ? (
            <div className="flex items-center gap-2 mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium">
              <XCircle className="w-4 h-4" /> This booking is cancelled
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Confirmed
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
          {!cancelled && !booking.canCancel && (
            <p className="text-xs text-slate-400 text-center">
              {booking.cancellationHours > 0
                ? `Bookings can only be cancelled online up to ${booking.cancellationHours} hours before the appointment. Please contact ${booking.business} directly.`
                : `Please contact ${booking.business} directly to make changes.`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
