'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2, Facebook, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'

type Page = { id: string; name: string }
type Account = { id: string; name: string }
type Report = { pages: Page[]; accounts: Account[]; mapping: Record<string, string>; error?: string | null }

export default function MetaLeadsPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/master/meta-leads')
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Failed to load'); return }
      setData(j)
      if (j.error) setError(j.error)
    } catch { setError('Failed to load') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function assign(page: Page, accountId: string) {
    setSavingId(page.id); setToast('')
    try {
      const r = await fetch('/api/master/meta-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, pageName: page.name, accountId: accountId || null }),
      })
      const j = await r.json()
      if (!r.ok) { setToast(j.error ?? 'Failed'); return }
      setData((d) => d ? { ...d, mapping: { ...d.mapping, [page.id]: accountId } } : d)
      setToast(
        !accountId ? `${page.name} unassigned`
        : j.subscribed ? `${page.name} → leads now flowing`
        : `${page.name} mapped, but subscribe failed: ${j.subscribeError ?? '?'}`
      )
    } finally { setSavingId(null) }
  }

  if (status === 'authenticated' && session?.user?.role !== 'master_admin') {
    return <p className="text-slate-500">This page is for master admins only.</p>
  }

  const assignedCount = data ? Object.values(data.mapping).filter(Boolean).length : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Facebook className="w-6 h-6 text-[#1877F2]" /> Facebook Lead Sync
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Map each Facebook Page to a client account. Instant Form leads then flow straight into that account&apos;s Leads — clients connect nothing.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
      </div>

      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {toast && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading pages from Business Manager…
        </div>
      )}

      {data && (
        <>
          <div className="text-sm text-slate-500 mb-3">
            {data.pages.length} pages in your Business Manager · <span className="text-emerald-700 font-medium">{assignedCount} mapped</span>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white divide-y divide-slate-100">
            {data.pages.map((page) => {
              const current = data.mapping[page.id] ?? ''
              const saving = savingId === page.id
              return (
                <div key={page.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{page.name}</p>
                    <p className="text-xs text-slate-400">{page.id}</p>
                  </div>
                  {current && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <select
                      value={current}
                      onChange={(e) => assign(page, e.target.value)}
                      className={`text-sm border rounded-lg px-2 py-1.5 bg-white ${current ? 'border-emerald-300 text-slate-800' : 'border-slate-200 text-slate-500'}`}
                    >
                      <option value="">— not mapped —</option>
                      {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                </div>
              )
            })}
            {data.pages.length === 0 && !error && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No pages found on the System User token.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
