'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, X, CreditCard } from 'lucide-react'
import { fmtAUD } from './QuoteModal'

type Payment = { id: string; amount: number; method: string; paidAt: string; notes: string | null }

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  card: 'Card',
  stripe: 'Card (Stripe)',
  other: 'Other',
}

export default function PaymentsPanel({ quoteId, total }: { quoteId: string; total: number }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [payingNow, setPayingNow] = useState(false)

  const fetchPayments = useCallback(async () => {
    const res = await fetch(`/api/quotes/${quoteId}/payments`)
    if (res.ok) setPayments(await res.json())
    setLoading(false)
  }, [quoteId])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = Math.max(0, total - paid)

  async function addPayment() {
    const n = parseFloat(amount)
    if (!n || n <= 0) { setError('Enter a valid amount'); return }
    setSaving(true); setError('')
    const res = await fetch(`/api/quotes/${quoteId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: n, method, paidAt, notes: notes.trim() || undefined }),
    })
    const data = await res.json()
    if (res.ok) {
      setPayments((p) => [data, ...p])
      setAmount(''); setNotes(''); setShowForm(false)
    } else {
      setError(data.error ?? 'Failed to record payment')
    }
    setSaving(false)
  }

  async function removePayment(id: string) {
    if (!confirm('Delete this payment record?')) return
    const res = await fetch(`/api/quotes/${quoteId}/payments/${id}`, { method: 'DELETE' })
    if (res.ok) setPayments((p) => p.filter((x) => x.id !== id))
  }

  async function payNow() {
    setPayingNow(true); setError('')
    const res = await fetch(`/api/quotes/${quoteId}/pay`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.url) {
      window.location.href = data.url
      return
    }
    setError(data.error ?? 'Could not start payment')
    setPayingNow(false)
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {fmtAUD(paid)} paid of {fmtAUD(total)}
            {balance > 0.01 && <span className="text-amber-600 font-medium"> · {fmtAUD(balance)} due</span>}
            {balance <= 0.01 && paid > 0 && <span className="text-emerald-600 font-medium"> · Paid in full</span>}
          </p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-3">
            {balance > 0.01 && (
              <button
                onClick={payNow}
                disabled={payingNow}
                className="flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg disabled:opacity-60"
              >
                {payingNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                Pay now
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" /> Record payment
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount" autoFocus
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input
              type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <input
            type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={addPayment}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save
            </button>
            <button onClick={() => { setShowForm(false); setError('') }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-3 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /></div>
      ) : payments.length > 0 ? (
        <div className="space-y-1.5">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs px-2.5 py-2 bg-white border border-slate-100 rounded-lg">
              <div>
                <span className="font-medium text-slate-900">{fmtAUD(p.amount)}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-500">{METHOD_LABELS[p.method] ?? p.method}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-500">{new Date(p.paidAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {p.notes && <span className="text-slate-400 ml-1.5">— {p.notes}</span>}
              </div>
              <button onClick={() => removePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">No payments recorded</p>
      )}
    </div>
  )
}
