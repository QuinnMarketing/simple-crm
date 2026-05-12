'use client'
import { useState } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'

type BusinessInfo = {
  abn: string
  businessAddress: string
  businessPhone: string
  businessEmail: string
  businessWebsite: string
}

export default function BusinessInfoForm({ accountId, initial }: { accountId: string; initial: BusinessInfo }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField(field: keyof BusinessInfo, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        abn: form.abn,
        businessAddress: form.businessAddress,
        businessPhone: form.businessPhone,
        businessEmail: form.businessEmail,
        businessWebsite: form.businessWebsite,
      }),
    })
    if (res.ok) {
      setSaved(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Save failed')
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-900 mb-1">Business Information</h2>
      <p className="text-slate-500 text-sm mb-5">
        Used on generated quote and invoice documents.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>ABN</label>
          <input
            type="text"
            value={form.abn}
            onChange={(e) => setField('abn', e.target.value)}
            placeholder="12 345 678 901"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Business Phone</label>
          <input
            type="tel"
            value={form.businessPhone}
            onChange={(e) => setField('businessPhone', e.target.value)}
            placeholder="02 9000 0000"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Business Address</label>
          <input
            type="text"
            value={form.businessAddress}
            onChange={(e) => setField('businessAddress', e.target.value)}
            placeholder="123 Example St, Sydney NSW 2000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Business Email</label>
          <input
            type="email"
            value={form.businessEmail}
            onChange={(e) => setField('businessEmail', e.target.value)}
            placeholder="info@yourbusiness.com.au"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input
            type="url"
            value={form.businessWebsite}
            onChange={(e) => setField('businessWebsite', e.target.value)}
            placeholder="www.yourbusiness.com.au"
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>
  )
}
