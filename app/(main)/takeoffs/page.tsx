'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Ruler, Plus, Loader2, Trash2, FileText, CheckCircle, Clock, XCircle } from 'lucide-react'

type Takeoff = {
  id: string
  name: string
  description: string | null
  status: string
  total: number
  createdAt: string
  updatedAt: string
  project: { id: string; name: string; color: string } | null
  lead: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  draft:    { label: 'Draft',    icon: FileText,     cls: 'bg-slate-100 text-slate-600' },
  sent:     { label: 'Sent',     icon: Clock,        cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', icon: CheckCircle,  cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', icon: XCircle,      cls: 'bg-red-100 text-red-700' },
}

export default function TakeoffsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountParam = searchParams.get('account')
  const [takeoffs, setTakeoffs] = useState<Takeoff[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState('')

  useEffect(() => {
    const url = accountParam ? `/api/takeoffs?account=${accountParam}` : '/api/takeoffs'
    fetch(url)
      .then(r => r.json())
      .then(data => { setTakeoffs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [accountParam])

  async function createTakeoff(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setNewError('')
    const body: Record<string, string> = { name: newName.trim() }
    if (accountParam) body.accountId = accountParam
    const res = await fetch('/api/takeoffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const t = await res.json()
      router.push(`/takeoffs/${t.id}`)
    } else {
      const d = await res.json().catch(() => ({}))
      setNewError(d.error ?? 'Failed to create')
      setCreating(false)
    }
  }

  async function deleteTakeoff(t: Takeoff) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return
    setDeletingId(t.id)
    await fetch(`/api/takeoffs/${t.id}`, { method: 'DELETE' })
    setTakeoffs(prev => prev.filter(x => x.id !== t.id))
    setDeletingId(null)
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

  const totalValue = takeoffs.reduce((s, t) => s + t.total, 0)
  const draftCount = takeoffs.filter(t => t.status === 'draft').length
  const approvedCount = takeoffs.filter(t => t.status === 'approved').length

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
          <h1 className="text-2xl font-bold text-slate-900">Takeoffs & Estimating</h1>
          <p className="text-slate-500 mt-1 text-sm">Create detailed material takeoffs and labour estimates</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setNewName(''); setNewError('') }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Takeoff
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Estimates</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{takeoffs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Value</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalValue)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{approvedCount} approved</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Drafts</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{draftCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">in progress</p>
        </div>
      </div>

      {/* New takeoff form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">New Takeoff</h2>
          <form onSubmit={createTakeoff} className="flex gap-3 items-start">
            <div className="flex-1">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. 42 Smith St — Concrete Driveway"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                required
              />
              {newError && <p className="text-red-600 text-xs mt-1">{newError}</p>}
            </div>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* List */}
      {takeoffs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <Ruler className="w-7 h-7 text-indigo-500" />
          </div>
          <p className="text-slate-700 font-medium">No takeoffs yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first estimate to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {takeoffs.map(t => {
            const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.draft
            const Icon = cfg.icon
            return (
              <div
                key={t.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => router.push(`/takeoffs/${t.id}`)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Ruler className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {t.project && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: t.project.color }} />
                          {t.project.name}
                        </span>
                      )}
                      {t.lead && (
                        <span className="text-xs text-slate-500">{t.lead.name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 min-w-[90px] text-right">
                    {t.total > 0 ? fmt(t.total) : '—'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteTakeoff(t) }}
                    disabled={deletingId === t.id}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
                  >
                    {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
