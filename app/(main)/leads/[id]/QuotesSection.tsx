'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, CheckCircle, Download, Send, Loader2, User } from 'lucide-react'
import QuoteModal, { Quote, STATUS_STYLES, fmtAUD, paymentBalance } from './QuoteModal'
import EmailModal from './EmailModal'

// ─── Section ───────────────────────────────────────────────────────────────────

interface Props {
  leadId: string
  leadEmail?: string | null
  leadName?: string
  leadService?: string | null
  leadNotes?: string | null
  leadAddress?: string | null
  onValueChange: (value: number | null) => void
}

export default function QuotesSection({ leadId, leadEmail, leadName = '', leadService, leadNotes, leadAddress, onValueChange }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [accountParam, setAccountParam] = useState<string | undefined>()
  const [modal, setModal] = useState<{ open: boolean; quote: Quote | null; type: 'quote' | 'invoice'; prefill?: Quote | null }>({
    open: false, quote: null, type: 'quote',
  })
  const [emailModal, setEmailModal] = useState<{ open: boolean; quoteId?: string; quoteNumber?: string }>({ open: false })
  const [invoicePrompt, setInvoicePrompt] = useState<Quote | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ap = new URLSearchParams(window.location.search).get('account')
      if (ap) setAccountParam(ap)
    }
  }, [])

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes?leadId=${leadId}`)
      if (res.ok) setQuotes(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  function openNew(type: 'quote' | 'invoice') { setModal({ open: true, quote: null, type }) }
  function openEdit(q: Quote) { setModal({ open: true, quote: q, type: q.type as 'quote' | 'invoice' }) }

  function handleSave(saved: Quote, newValue: number | null) {
    const wasAlreadyAccepted = quotes.find((q) => q.id === saved.id)?.status === 'accepted'
    setQuotes((prev) => {
      const idx = prev.findIndex((q) => q.id === saved.id)
      return idx >= 0 ? prev.map((q) => q.id === saved.id ? saved : q) : [...prev, saved]
    })
    if (newValue !== null) onValueChange(newValue)
    setModal({ open: false, quote: null, type: 'quote' })
    if (saved.type === 'quote' && saved.status === 'accepted' && !wasAlreadyAccepted) {
      setInvoicePrompt(saved)
    }
  }

  function handleDelete(id: string) {
    setQuotes((prev) => prev.filter((q) => q.id !== id))
    setModal({ open: false, quote: null, type: 'quote' })
  }

  const quoteList = quotes.filter((q) => q.type === 'quote')
  const invoiceList = quotes.filter((q) => q.type === 'invoice')

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">Quotes & Invoices</h2>
        <div className="flex gap-2">
          <button
            onClick={() => openNew('quote')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Quote
          </button>
          <button
            onClick={() => openNew('invoice')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Invoice
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <FileText className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No quotes or invoices yet</p>
        </div>
      ) : (
        <div>
          {[{ label: 'Quotes', list: quoteList }, { label: 'Invoices', list: invoiceList }].map(({ label, list }) =>
            list.length === 0 ? null : (
              <div key={label}>
                {quotes.some((q) => q.type === 'quote') && quotes.some((q) => q.type === 'invoice') && (
                  <p className="px-6 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-50">
                    {label}
                  </p>
                )}
                <div className="divide-y divide-slate-50">
                  {list.map((q) => (
                    <div key={q.id} className="flex items-center hover:bg-slate-50 transition-colors">
                      <button
                        onClick={() => openEdit(q)}
                        className="flex-1 flex items-center justify-between px-6 py-3.5 text-left min-w-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{q.number}</p>
                            {q.issuedAt && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                Issued {new Date(q.issuedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                            {q.createdByName && (
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <User className="w-3 h-3" />{q.createdByName}
                              </p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${STATUS_STYLES[q.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {q.status}
                          </span>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-sm font-semibold text-slate-900 tabular-nums">
                            {fmtAUD(q.total)}
                          </p>
                          {q.type === 'invoice' && (() => {
                            const { paid, balance, state } = paymentBalance(q)
                            if (state === 'unpaid') return null
                            return (
                              <p className={`text-xs mt-0.5 font-medium ${state === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {state === 'paid' ? 'Paid in full' : `${fmtAUD(paid)} paid · ${fmtAUD(balance)} due`}
                              </p>
                            )
                          })()}
                        </div>
                      </button>
                      {leadEmail && (
                        <button
                          title="Email to lead"
                          onClick={(e) => { e.stopPropagation(); setEmailModal({ open: true, quoteId: q.id, quoteNumber: q.number }) }}
                          className="pl-2 py-3.5 text-slate-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      <a
                        href={`/api/quotes/${q.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open PDF"
                        className="pr-5 pl-2 py-3.5 text-slate-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {modal.open && (
        <QuoteModal
          initial={modal.quote}
          prefill={modal.prefill}
          type={modal.type}
          leadId={leadId}
          leadEmail={leadEmail}
          leadName={leadName}
          leadService={leadService}
          leadNotes={leadNotes}
          leadAddress={leadAddress}
          accountParam={accountParam}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal({ open: false, quote: null, type: 'quote' })}
        />
      )}

      {emailModal.open && (
        <EmailModal
          leadId={leadId}
          leadEmail={leadEmail ?? null}
          leadName={leadName}
          quoteId={emailModal.quoteId}
          quoteNumber={emailModal.quoteNumber}
          onClose={() => setEmailModal({ open: false })}
        />
      )}

      {invoicePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Quote accepted</p>
                <p className="text-sm text-slate-500">Create an invoice from {invoicePrompt.number}?</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModal({ open: true, quote: null, type: 'invoice', prefill: invoicePrompt })
                  setInvoicePrompt(null)
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Invoice
              </button>
              <button
                onClick={() => setInvoicePrompt(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
