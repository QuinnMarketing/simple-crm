'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost']
const SOURCES = ['website', 'referral', 'google_ads', 'facebook_ads', 'cold_outreach', 'other']

type Company = { id: string; name: string; color: string }

export default function NewLeadPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const preselectedCompany = sp.get('company') ?? ''

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', service: '',
    source: '', status: 'new', value: '', notes: '',
    companyId: preselectedCompany,
  })

  useEffect(() => {
    fetch('/api/companies').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCompanies(d) })
  }, [])

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        value: form.value ? parseFloat(form.value) : null,
        companyId: form.companyId || null,
      }),
    })
    if (res.ok) {
      const lead = await res.json()
      router.push(`/leads/${lead.id}`)
    } else {
      setError('Failed to create lead. Please try again.')
      setSaving(false)
    }
  }

  const backHref = preselectedCompany ? `/leads?company=${preselectedCompany}` : '/leads'
  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div>
      <div className="mb-6">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Add Lead</h1>
        <p className="text-slate-500 mt-1 text-sm">Manually add a new lead to your CRM</p>
      </div>

      <div className="max-w-2xl bg-white rounded-xl border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required className={inputCls} placeholder="Jane Smith" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="jane@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="0400 000 000" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
              <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} placeholder="123 Example St, Sydney NSW 2000" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
              <select value={form.companyId} onChange={(e) => set('companyId', e.target.value)} className={inputCls + ' bg-white'}>
                <option value="">— No company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Service Interested In</label>
              <input type="text" value={form.service} onChange={(e) => set('service', e.target.value)} className={inputCls} placeholder="e.g. Concrete driveway" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Estimated Value (AUD)</label>
              <input type="number" value={form.value} onChange={(e) => set('value', e.target.value)} min="0" step="100" className={inputCls} placeholder="5000" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls + ' bg-white capitalize'}>
                {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Source</label>
              <select value={form.source} onChange={(e) => set('source', e.target.value)} className={inputCls + ' bg-white'}>
                <option value="">— Select source —</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={4} className={inputCls + ' resize-none'} placeholder="Any relevant details about this lead…" />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Lead'}
            </button>
            <Link href={backHref} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
