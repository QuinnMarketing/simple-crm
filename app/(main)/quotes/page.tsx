'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Plus, Loader2 } from 'lucide-react'

type Quote = {
  id: string; type: string; number: string; status: string
  lineItems: string; subtotal: number; taxRate: number; taxAmount: number; total: number
  notes: string | null; issuedAt: string | null; dueAt: string | null
  createdAt: string; updatedAt: string
  lead: { id: string; name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  sent:      'bg-blue-100 text-blue-700',
  accepted:  'bg-emerald-100 text-emerald-700',
  declined:  'bg-red-100 text-red-700',
  paid:      'bg-emerald-100 text-emerald-700',
  overdue:   'bg-orange-100 text-orange-700',
  cancelled: 'bg-slate-100 text-slate-400',
}

function fmtAUD(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
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
  const paidValue = quotes.filter((q) => q.status === 'paid' || q.status === 'accepted').reduce((s, q) => s + q.total, 0)

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
                  <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                    <td className="px-4 py-3">
                      {q.lead ? (
                        <Link href={`/leads/${q.lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {q.number}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {q.number}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.type === 'quote' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                        {q.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {q.lead ? (
                        <Link href={`/leads/${q.lead.id}`} className="text-indigo-600 hover:underline truncate block max-w-[120px]">
                          {q.lead.name}
                        </Link>
                      ) : <span className="text-slate-400">—</span>}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
