'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Loader2, Trash2, FileText, CheckCircle, Download, Send, Sparkles, ChevronDown, ChevronUp, BookOpen, User } from 'lucide-react'
import EmailModal from './EmailModal'

type LineItem = { description: string; quantity: number; unitPrice: number }

type Quote = {
  id: string; type: string; number: string; status: string
  lineItems: string; subtotal: number; taxRate: number; taxAmount: number; total: number
  notes: string | null; issuedAt: string | null; dueAt: string | null
  createdByName: string | null; createdAt: string; updatedAt: string
}

type PriceItem = { id: string; name: string; description: string | null; price: number; unit: string; category: string | null }

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined']
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled']

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

function toDateInput(iso: string | null): string {
  return iso ? iso.split('T')[0] : ''
}

function emptyLine(): LineItem {
  return { description: '', quantity: 1, unitPrice: 0 }
}

function calcTotals(items: LineItem[], taxRate: number) {
  const subtotal = items.reduce((s, li) => s + li.quantity * li.unitPrice, 0)
  const taxAmount = subtotal * taxRate / 100
  return { subtotal, taxAmount, total: subtotal + taxAmount }
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: Quote | null
  prefill?: Quote | null
  type: 'quote' | 'invoice'
  leadId: string
  leadEmail?: string | null
  leadName?: string
  leadService?: string | null
  leadNotes?: string | null
  leadAddress?: string | null
  accountParam?: string
  onSave: (q: Quote, newValue: number | null) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function QuoteModal({ initial, prefill, type, leadId, leadEmail, leadName = '', leadService, leadNotes, leadAddress, accountParam, onSave, onDelete, onClose }: ModalProps) {
  const isEdit = !!initial
  const todayStr = new Date().toISOString().split('T')[0]
  const [status, setStatus] = useState(initial?.status ?? 'draft')
  const [sendEmail, setSendEmail] = useState(false)
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? prefill?.taxRate ?? 10)
  const [notes, setNotes] = useState(initial?.notes ?? prefill?.notes ?? '')
  const [issuedAt, setIssuedAt] = useState(initial?.issuedAt ? toDateInput(initial.issuedAt) : todayStr)
  const [dueAt, setDueAt] = useState(toDateInput(initial?.dueAt ?? null))
  const [items, setItems] = useState<LineItem[]>(() =>
    initial ? JSON.parse(initial.lineItems) :
    prefill ? JSON.parse(prefill.lineItems) :
    [emptyLine()]
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(!initial && !prefill)
  const [aiPrompt, setAiPrompt] = useState(() => [leadService, leadNotes].filter(Boolean).join('\n').trim())
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [priceItems, setPriceItems] = useState<PriceItem[]>([])
  const [priceBookOpen, setPriceBookOpen] = useState(false)
  const [priceSearch, setPriceSearch] = useState('')

  useEffect(() => {
    const url = accountParam ? `/api/price-book?account=${accountParam}` : '/api/price-book'
    fetch(url).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setPriceItems(data.filter((i: PriceItem & { active: boolean }) => i.active !== false))
    }).catch(() => {})
  }, [accountParam])

  const filteredPriceItems = priceItems.filter(item =>
    !priceSearch ||
    item.name.toLowerCase().includes(priceSearch.toLowerCase()) ||
    (item.category?.toLowerCase().includes(priceSearch.toLowerCase()))
  )

  function addFromPriceBook(item: PriceItem) {
    const desc = item.description ? `${item.name} — ${item.description}` : item.name
    setItems(prev => [...prev, { description: desc, quantity: 1, unitPrice: item.price }])
    setPriceBookOpen(false)
    setPriceSearch('')
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return
    setAiGenerating(true); setAiError(null)
    try {
      const res = await fetch('/api/quotes/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, leadName, leadService, leadNotes, leadAddress, type, accountParam }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Generation failed'); return }
      setItems(data.lineItems.map((li: { description: string; quantity: number; unitPrice: number }) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })))
      if (data.notes) setNotes(data.notes)
      setAiOpen(false)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setAiGenerating(false)
    }
  }

  const { subtotal, taxAmount, total } = calcTotals(items, taxRate)
  const statuses = type === 'quote' ? QUOTE_STATUSES : INVOICE_STATUSES

  function setItem(i: number, field: keyof LineItem, raw: string) {
    setItems((prev) => prev.map((li, idx) => {
      if (idx !== i) return li
      if (field === 'description') return { ...li, description: raw }
      const n = parseFloat(raw) || 0
      return { ...li, [field]: n }
    }))
  }

  function addLine() { setItems((prev) => [...prev, emptyLine()]) }
  function removeLine(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    const validItems = items.filter((li) => li.description.trim())
    if (validItems.length === 0) { setError('Add at least one line item'); return }
    setSaving(true); setError(null)
    try {
      const payload = { status, lineItems: validItems, taxRate, notes: notes.trim() || null, issuedAt: issuedAt || null, dueAt: dueAt || null, leadId }
      const res = await fetch(
        isEdit ? `/api/quotes/${initial!.id}` : '/api/quotes',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, type }) }
      )
      if (res.ok) {
        const saved: Quote = await res.json()
        const inactive = ['cancelled', 'declined'].includes(saved.status)
        onSave(saved, inactive ? null : saved.total)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Error ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initial || !confirm(`Delete ${initial.number}?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/quotes/${initial.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(initial.id)
      else setError(`Delete failed: ${res.status}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = 'px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">
              {isEdit ? `Edit ${initial!.number}` : `New ${type === 'quote' ? 'Quote' : 'Invoice'}`}
            </h2>
            {isEdit && initial?.createdByName && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3" /> Raised by {initial.createdByName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Meta row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-full bg-white capitalize`}>
                {statuses.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>{type === 'quote' ? 'Valid Until' : 'Due Date'}</label>
              <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={`${inputCls} w-full`} />
            </div>
          </div>

          {/* AI Generate panel */}
          <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </span>
              {aiOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {aiOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-indigo-100">
                <p className="text-xs text-indigo-600 pt-3">Describe the job and AI will suggest line items based on your price book.</p>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="e.g. Supply and install 20m² of porcelain tiles in bathroom, including waterproofing and grout…"
                  className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none"
                />
                {aiError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{aiError}</p>}
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiGenerating ? 'Generating…' : 'Generate line items'}
                </button>
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <label className={labelCls}>Line Items</label>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide w-16">Qty</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((li, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={li.description}
                          onChange={(e) => setItem(i, 'description', e.target.value)}
                          placeholder="Description…"
                          className="w-full px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={li.quantity}
                          min="0"
                          step="1"
                          onChange={(e) => setItem(i, 'quantity', e.target.value)}
                          className="w-full px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={li.unitPrice}
                          min="0"
                          step="0.01"
                          onChange={(e) => setItem(i, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent text-right"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-700 font-medium tabular-nums">
                        {fmtAUD(li.quantity * li.unitPrice)}
                      </td>
                      <td className="pr-2 py-1.5 text-center">
                        {items.length > 1 && (
                          <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-4">
                <button onClick={addLine} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add line item
                </button>
                {priceItems.length > 0 && (
                  <button
                    onClick={() => { setPriceBookOpen(o => !o); setPriceSearch('') }}
                    className={`text-xs font-medium flex items-center gap-1 transition-colors ${priceBookOpen ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <BookOpen className="w-3.5 h-3.5" /> From price book
                  </button>
                )}
              </div>
              {priceBookOpen && (
                <div className="border-t border-slate-100">
                  <div className="px-3 pt-2 pb-1">
                    <input
                      type="text"
                      value={priceSearch}
                      onChange={e => setPriceSearch(e.target.value)}
                      placeholder="Search price book…"
                      autoFocus
                      className="w-full text-sm px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                    {filteredPriceItems.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-400 text-center">No items match</p>
                    ) : filteredPriceItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => addFromPriceBook(item)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                          {item.category && <p className="text-xs text-indigo-400">{item.category}</p>}
                          {item.description && <p className="text-xs text-slate-400 truncate">{item.description}</p>}
                        </div>
                        <p className="text-sm font-semibold text-slate-700 tabular-nums ml-3 flex-shrink-0">
                          {fmtAUD(item.price)}<span className="text-xs text-slate-400 font-normal ml-0.5">/{item.unit}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Totals + Tax */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <label className={labelCls}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Payment terms, thank you note…"
                className={`${inputCls} w-full resize-none`}
              />
            </div>
            <div className="w-56 space-y-2 text-sm flex-shrink-0">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmtAUD(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1.5">
                  Tax
                  <input
                    type="number"
                    value={taxRate}
                    min="0"
                    max="100"
                    step="0.5"
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-12 text-xs border border-slate-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-xs">%</span>
                </span>
                <span className="tabular-nums">{fmtAUD(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total</span>
                <span className="tabular-nums">{fmtAUD(total)}</span>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
              Cancel
            </button>
            {isEdit && leadEmail && (
              <button
                onClick={() => setSendEmail(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-700 border border-indigo-200 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Email
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {sendEmail && initial && (
        <EmailModal
          leadId={leadId}
          leadEmail={leadEmail ?? null}
          leadName={leadName}
          quoteId={initial.id}
          quoteNumber={initial.number}
          onClose={() => setSendEmail(false)}
        />
      )}
    </div>
  )
}

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
                        <p className="text-sm font-semibold text-slate-900 tabular-nums ml-4 flex-shrink-0">
                          {fmtAUD(q.total)}
                        </p>
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
