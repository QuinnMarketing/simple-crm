'use client'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

type DocSettings = {
  quotePrefix: string
  invoicePrefix: string
  nextQuoteNum: number
  nextInvoiceNum: number
  numberPadding: number
}

function preview(prefix: string, next: number, padding: number) {
  return `${prefix}${String(next).padStart(padding, '0')}`
}

export default function DocumentNumberingForm({
  accountId,
  initial,
}: {
  accountId: string
  initial: DocSettings
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof DocSettings>(key: K, val: DocSettings[K]) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/settings/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        setForm(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Save failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-900 mb-1">Document Numbering</h2>
      <p className="text-slate-500 text-sm mb-5">Configure how quote and invoice numbers are generated.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Quotes */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quotes</p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Prefix</label>
            <input
              value={form.quotePrefix}
              onChange={e => set('quotePrefix', e.target.value)}
              placeholder="Q-"
              className={inputCls}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Next number</label>
            <input
              type="number"
              min={1}
              value={form.nextQuoteNum}
              onChange={e => set('nextQuoteNum', parseInt(e.target.value) || 1)}
              className={inputCls}
            />
          </div>
          <div className="text-xs text-slate-400">
            Next quote will be: <span className="font-mono font-semibold text-slate-700">{preview(form.quotePrefix, form.nextQuoteNum, form.numberPadding)}</span>
          </div>
        </div>

        {/* Invoices */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoices</p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Prefix</label>
            <input
              value={form.invoicePrefix}
              onChange={e => set('invoicePrefix', e.target.value)}
              placeholder="INV-"
              className={inputCls}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Next number</label>
            <input
              type="number"
              min={1}
              value={form.nextInvoiceNum}
              onChange={e => set('nextInvoiceNum', parseInt(e.target.value) || 1)}
              className={inputCls}
            />
          </div>
          <div className="text-xs text-slate-400">
            Next invoice will be: <span className="font-mono font-semibold text-slate-700">{preview(form.invoicePrefix, form.nextInvoiceNum, form.numberPadding)}</span>
          </div>
        </div>
      </div>

      {/* Padding */}
      <div className="mt-5 max-w-xs">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Number padding (digits)</label>
        <select
          value={form.numberPadding}
          onChange={e => set('numberPadding', parseInt(e.target.value))}
          className={`${inputCls} bg-white`}
        >
          {[2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n} digits — e.g. {String(1).padStart(n, '0')}</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
      </div>
    </div>
  )
}
