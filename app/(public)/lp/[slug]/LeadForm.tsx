'use client'
import { useState } from 'react'

type Props = {
  webhookToken: string
  title: string
  buttonLabel: string
  fields: string[]
  thankYouHeadline: string
  thankYouMessage: string
  primaryColor: string
}

const FIELD_META: Record<string, { label: string; type: string; textarea?: boolean }> = {
  name: { label: 'Name', type: 'text' },
  phone: { label: 'Phone', type: 'tel' },
  email: { label: 'Email', type: 'email' },
  address: { label: 'Address / Suburb', type: 'text' },
  message: { label: 'How can we help?', type: 'text', textarea: true },
}

/** Pulls ad-click + UTM attribution off the page URL so the lead lands in the CRM fully attributed. */
function attributionParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  const out: Record<string, string> = { page_url: window.location.href }
  for (const key of ['gclid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = params.get(key)
    if (v) out[key] = v
  }
  return out
}

export default function LeadForm({ webhookToken, title, buttonLabel, fields, thankYouHeadline, thankYouMessage, primaryColor }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const visibleFields = fields.filter(f => FIELD_META[f])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/webhooks/form?token=${encodeURIComponent(webhookToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, ...attributionParams() }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setError('Something went wrong — please try again or give us a call.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900">{thankYouHeadline}</h3>
        <p className="text-slate-600 mt-2">{thankYouMessage}</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      {visibleFields.map(f => {
        const meta = FIELD_META[f]
        const required = f === 'name' || f === 'phone'
        return (
          <div key={f}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {meta.label}{required && <span className="text-red-500"> *</span>}
            </label>
            {meta.textarea ? (
              <textarea
                rows={3}
                required={required}
                value={values[f] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:border-transparent resize-none"
              />
            ) : (
              <input
                type={meta.type}
                required={required}
                value={values[f] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:border-transparent"
              />
            )}
          </div>
        )
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 rounded-lg text-white font-semibold text-lg transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? 'Sending…' : buttonLabel}
      </button>
      <p className="text-xs text-slate-400 text-center">No spam, no obligation. Your details stay private.</p>
    </form>
  )
}
