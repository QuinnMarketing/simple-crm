'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Rocket, Loader2, X, ExternalLink, Eye, Users, Percent, Phone, FileText } from 'lucide-react'

type PageRow = {
  id: string
  name: string
  slug: string
  status: string
  goal: string
  views: number
  leads: number
  updatedAt: string
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

export default function LandingPagesPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const accountParam = sp.get('account')

  const [pages, setPages] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [brief, setBrief] = useState({ service: '', location: '', offer: '', goal: 'form', notes: '' })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const fetchPages = useCallback(async () => {
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/landing-pages${qs}`)
    if (res.ok) setPages(await res.json())
    setLoading(false)
  }, [accountParam])

  useEffect(() => { fetchPages() }, [fetchPages])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setError('')
    const res = await fetch('/api/landing-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief, ...(accountParam ? { accountId: accountParam } : {}) }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/landing-pages/${data.id}${accountParam ? `?account=${accountParam}` : ''}`)
    } else {
      setError(data.error ?? 'Generation failed')
      setGenerating(false)
    }
  }

  function convRate(p: PageRow): string {
    if (p.views === 0) return '—'
    return `${Math.round((p.leads / p.views) * 100)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Landing Pages</h1>
          <p className="text-slate-500 mt-1 text-sm">High-conversion pages for ads and email campaigns — leads flow straight into your pipeline</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError('') }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Landing Page
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-900">Tell us about the campaign</h2>
            <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-slate-500 mb-5">AI writes the whole page using your business details, price book, and real customer reviews. You can edit everything before publishing.</p>
          <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Service being promoted <span className="text-red-500">*</span></label>
              <input type="text" required value={brief.service} onChange={e => setBrief(b => ({ ...b, service: e.target.value }))} className={inputCls} placeholder="e.g. Blocked drain clearing" />
            </div>
            <div>
              <label className={labelCls}>Service area <span className="text-red-500">*</span></label>
              <input type="text" required value={brief.location} onChange={e => setBrief(b => ({ ...b, location: e.target.value }))} className={inputCls} placeholder="e.g. Hills District, Sydney" />
            </div>
            <div>
              <label className={labelCls}>Offer <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
              <input type="text" value={brief.offer} onChange={e => setBrief(b => ({ ...b, offer: e.target.value }))} className={inputCls} placeholder="e.g. $99 drain camera inspection" />
            </div>
            <div>
              <label className={labelCls}>Page goal</label>
              <div className="flex gap-2">
                {([
                  { value: 'form', label: 'Form leads', Icon: FileText },
                  { value: 'call', label: 'Phone calls', Icon: Phone },
                  { value: 'both', label: 'Both', Icon: Rocket },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBrief(b => ({ ...b, goal: value }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      brief.goal === value ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Anything else to emphasise? <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
              <textarea rows={2} value={brief.notes} onChange={e => setBrief(b => ({ ...b, notes: e.target.value }))} className={`${inputCls} resize-none`} placeholder="e.g. Same-day service, 25 years experience, seniors discount" />
            </div>
            {error && <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="sm:col-span-2">
              <button type="submit" disabled={generating} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing your page… (~30 seconds)</> : <><Rocket className="w-4 h-4" /> Generate Page</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <Rocket className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium text-slate-600">No landing pages yet</p>
          <p className="text-sm mt-1">Create one for your next ad campaign or email blast</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {pages.map(p => (
            <div key={p.id} className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors">
              <Link href={`/landing-pages/${p.id}${accountParam ? `?account=${accountParam}` : ''}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-900 truncate">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.status}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    {p.goal === 'call' ? <Phone className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    {p.goal === 'call' ? 'Calls' : p.goal === 'both' ? 'Calls + form' : 'Form leads'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 truncate">/lp/{p.slug}</p>
              </Link>
              <div className="hidden sm:flex items-center gap-5 text-sm text-slate-500 flex-shrink-0">
                <span className="flex items-center gap-1.5" title="Views"><Eye className="w-4 h-4 text-slate-300" />{p.views}</span>
                <span className="flex items-center gap-1.5" title="Leads"><Users className="w-4 h-4 text-slate-300" />{p.leads}</span>
                <span className="flex items-center gap-1.5" title="Conversion rate"><Percent className="w-4 h-4 text-slate-300" />{convRate(p)}</span>
              </div>
              <a
                href={`/lp/${p.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open page"
                className="text-slate-400 hover:text-indigo-600 transition-colors flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
