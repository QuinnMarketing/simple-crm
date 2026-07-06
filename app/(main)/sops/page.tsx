'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Loader2, X, Sparkles, PenLine, ClipboardList, Bot } from 'lucide-react'
import { INDUSTRY_SOP_SUGGESTIONS } from '@/lib/sop-industries'

type SopRow = {
  id: string
  title: string
  industry: string | null
  category: string | null
  source: string
  updatedAt: string
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'
const INDUSTRIES = Object.keys(INDUSTRY_SOP_SUGGESTIONS)

export default function SopsPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const accountParam = sp.get('account')

  const [sops, setSops] = useState<SopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [mode, setMode] = useState<'ai' | 'custom'>('ai')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // AI brief
  const [industry, setIndustry] = useState('Plumbing')
  const [customIndustry, setCustomIndustry] = useState('')
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')

  // Custom SOP
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Operations')

  const fetchSops = useCallback(async () => {
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/sops${qs}`)
    if (res.ok) setSops(await res.json())
    setLoading(false)
  }, [accountParam])

  useEffect(() => { fetchSops() }, [fetchSops])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const effectiveIndustry = industry === 'Other' ? customIndustry.trim() : industry
    const payload = mode === 'ai'
      ? { generate: { industry: effectiveIndustry, topic: topic.trim(), notes: notes.trim() || undefined } }
      : { title: title.trim(), category, industry: effectiveIndustry, content: '' }

    const res = await fetch('/api/sops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...(accountParam ? { accountId: accountParam } : {}) }),
    })
    const data = await res.json()
    if (res.ok) {
      const params = new URLSearchParams()
      if (accountParam) params.set('account', accountParam)
      if (mode === 'custom') params.set('edit', '1') // land straight in edit mode for blank custom SOPs
      const qs = params.toString()
      router.push(`/sops/${data.id}${qs ? `?${qs}` : ''}`)
    } else {
      setError(data.error ?? 'Failed to create SOP')
      setSaving(false)
    }
  }

  const suggestions = INDUSTRY_SOP_SUGGESTIONS[industry] ?? []
  const grouped = sops.reduce<Record<string, SopRow[]>>((acc, s) => {
    const key = s.category || 'Uncategorised'
    ;(acc[key] = acc[key] || []).push(s)
    return acc
  }, {})

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
          <h1 className="text-2xl font-bold text-slate-900">SOPs</h1>
          <p className="text-slate-500 mt-1 text-sm">Standard operating procedures — generate with AI for your industry, or write your own</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError('') }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New SOP
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMode('ai')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${mode === 'ai' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Sparkles className="w-4 h-4" /> Generate with AI
              </button>
              <button
                onClick={() => setMode('custom')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${mode === 'custom' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <PenLine className="w-4 h-4" /> Write your own
              </button>
            </div>
            <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          <form onSubmit={create} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Industry</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} className={`${inputCls} bg-white`}>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  <option value="Other">Other…</option>
                </select>
              </div>
              {industry === 'Other' && (
                <div>
                  <label className={labelCls}>Your industry</label>
                  <input type="text" required value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} className={inputCls} placeholder="e.g. Pest control" />
                </div>
              )}
              {mode === 'custom' && (
                <div>
                  <label className={labelCls}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={`${inputCls} bg-white`}>
                    {['Safety', 'Operations', 'Sales', 'Admin', 'Quality'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>

            {mode === 'ai' ? (
              <>
                <div>
                  <label className={labelCls}>What process should this SOP cover? <span className="text-red-500">*</span></label>
                  <input type="text" required value={topic} onChange={e => setTopic(e.target.value)} className={inputCls} placeholder="e.g. Emergency callout response" />
                  {suggestions.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {suggestions.map(s => (
                        <button key={s} type="button" onClick={() => setTopic(s)} className="text-xs bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 px-2.5 py-1 rounded-full transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Business-specific requirements <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                  <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} placeholder="e.g. We always send a job confirmation SMS before arriving; two-person rule for roof work" />
                </div>
              </>
            ) : (
              <div>
                <label className={labelCls}>SOP title <span className="text-red-500">*</span></label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="e.g. SOP: Vehicle pre-start checks" />
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'ai' ? 'Writing your SOP… (~30 seconds)' : 'Creating…'}</>
                : mode === 'ai' ? <><Sparkles className="w-4 h-4" /> Generate SOP</> : <><Plus className="w-4 h-4" /> Create & Edit</>}
            </button>
          </form>
        </div>
      )}

      {sops.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <ClipboardList className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium text-slate-600">No SOPs yet</p>
          <p className="text-sm mt-1">Generate your first procedure in under a minute</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{cat}</h2>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {items.map(s => (
                  <Link
                    key={s.id}
                    href={`/sops/${s.id}${accountParam ? `?account=${accountParam}` : ''}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ClipboardList className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{s.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[s.industry, `Updated ${new Date(s.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    {s.source === 'ai' && (
                      <span className="flex items-center gap-1 text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
                        <Bot className="w-3 h-3" /> AI
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
