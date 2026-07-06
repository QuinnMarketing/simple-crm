'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import QuoteModal, { Quote as ModalQuote, STATUS_STYLES, fmtAUD, paymentBalance } from '../leads/[id]/QuoteModal'

type Quote = ModalQuote & {
  leadId: string | null
  lead: { id: string; name: string; email: string | null; service: string | null; notes: string | null; address: string | null } | null
}

const TABS = [
  { key: '', label: 'All' },
  { key: 'quote', label: 'Quotes' },
  { key: 'invoice', label: 'Invoices' },
]

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')
  const [selected, setSelected] = useState<Quote | null>(null)

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tab) params.set('type', tab)
      const res = await fetch(`/api/quotes?${params}`)
      if (res.ok) setQuotes(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  const totalValue = quotes.reduce((s, q) => s + q.total, 0)
  const paidValue = quotes.filter((q) => q.status === 'paid' || q.status === 'accepted' || q.status === 'approved').reduce((s, q) => s + q.total, 0)

  function handleSave(saved: ModalQuote) {
    setQuotes((prev) => prev.map((q) => q.id === saved.id ? { ...q, ...saved } : q))
    setSelected(null)
  }

  function handleDelete(id: string) {
    setQuotes((prev) => prev.filter((q) => q.id !== id))
    setSelected(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotes & Invoices</h1>
          <p className="text-slate-500 mt-1 text-sm">All documents across your leads</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Documents</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{quotes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Value</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{fmtAUD(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Accepted / Paid</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{fmtAUD(paidValue)}</p>
        </div>
      </div>

      {/* Tab filter */}
      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs mt-1">Open a lead to create a quote or invoice</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    { label: 'Number', cls: '' },
                    { label: 'Type', cls: 'hidden sm:table-cell' },
                    { label: 'Lead', cls: '' },
                    { label: 'Status', cls: '' },
                    { label: 'Issued', cls: 'hidden md:table-cell' },
                    { label: 'Due / Expiry', cls: 'hidden lg:table-cell' },
                    { label: 'Total', cls: '' },
                  ].map(({ label, cls }) => (
                    <th key={label} className={`text-left text-xs font-medium text-slate-500 px-4 py-3 uppercase tracking-wide ${cls}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => setSelected(q)}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        {q.number}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.type === 'quote' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                        {q.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {q.lead
                        ? <span className="text-slate-700 truncate block max-w-[120px]">{q.lead.name}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[q.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell">
                      {q.issuedAt ? new Date(q.issuedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden lg:table-cell">
                      {q.dueAt ? new Date(q.dueAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {fmtAUD(q.total)}
                      {q.type === 'invoice' && (() => {
                        const { paid, balance, state } = paymentBalance(q)
                        if (state === 'unpaid') return null
                        return (
                          <p className={`text-xs font-medium mt-0.5 ${state === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {state === 'paid' ? 'Paid in full' : `${fmtAUD(balance)} due`}
                          </p>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <QuoteModal
          initial={selected}
          type={selected.type as 'quote' | 'invoice'}
          leadId={selected.leadId ?? ''}
          leadEmail={selected.lead?.email}
          leadName={selected.lead?.name}
          leadService={selected.lead?.service}
          leadNotes={selected.lead?.notes}
          leadAddress={selected.lead?.address}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
