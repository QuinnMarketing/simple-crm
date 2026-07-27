'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Loader2, Download, TrendingUp, Clock, DollarSign, Users, CalendarDays } from 'lucide-react'
import Link from 'next/link'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
}
function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website', referral: 'Referral', google_ads: 'Google Ads',
  facebook_ads: 'Facebook Ads', cold_outreach: 'Cold Outreach', webhook: 'Webhook', other: 'Other',
}
const STATUS_COLORS: Record<string, string> = {
  new: '#6366f1', contacted: '#3b82f6', quoted: '#f59e0b', won: '#10b981',
  lost: '#ef4444', draft: '#94a3b8', sent: '#6366f1', accepted: '#10b981', cancelled: '#ef4444',
}
const TYPE_COLORS: Record<string, string> = {
  call: '#3b82f6', meeting: '#a855f7', work: '#10b981', email: '#f59e0b', admin: '#64748b', other: '#f43f5e',
}

// ─── Date range presets ───────────────────────────────────────────────────────

type Preset = '7d' | '30d' | '90d' | 'ytd' | 'all'

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  if (p === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    return { from: d.toISOString().split('T')[0], to }
  }
  if (p === '30d') {
    const d = new Date(now); d.setDate(d.getDate() - 30)
    return { from: d.toISOString().split('T')[0], to }
  }
  if (p === '90d') {
    const d = new Date(now); d.setDate(d.getDate() - 90)
    return { from: d.toISOString().split('T')[0], to }
  }
  if (p === 'ytd') {
    return { from: `${now.getFullYear()}-01-01`, to }
  }
  return { from: '2020-01-01', to }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-700 mb-3">{children}</h3>
}

function exportCsv(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Lead Report ──────────────────────────────────────────────────────────────

interface LeadsData {
  total: number; won: number; lost: number; conversionRate: number
  totalValue: number; wonValue: number; avgDeal: number
  bySource: { source: string; count: number }[]
  byStatus: { status: string; count: number; value: number }[]
  leads: { id: string; name: string; email?: string | null; status: string; source?: string | null; value?: number | null; createdAt: string }[]
}

function LeadsReport({ from, to, account }: { from: string; to: string; account?: string }) {
  const [data, setData] = useState<LeadsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ from, to, ...(account ? { account } : {}) })
    fetch(`/api/reports/leads?${qs}`).then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [from, to, account])

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (!data) return null

  function handleExport() {
    if (!data) return
    const rows = [
      ['Name', 'Email', 'Status', 'Source', 'Value', 'Created'],
      ...data.leads.map(l => [l.name, l.email ?? '', capitalize(l.status), SOURCE_LABELS[l.source ?? ''] ?? l.source ?? '', l.value ? String(l.value) : '', fmtDate(l.createdAt)]),
    ]
    exportCsv(rows, `leads-report-${from}-${to}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={String(data.total)} icon={Users} color="bg-indigo-100 text-indigo-600" />
        <StatCard label="Won" value={String(data.won)} sub={`${data.conversionRate}% conversion`} icon={TrendingUp} color="bg-emerald-100 text-emerald-600" />
        <StatCard label="Won Value" value={fmtCurrency(data.wonValue)} sub="closed deals" icon={DollarSign} color="bg-green-100 text-green-600" />
        <StatCard label="Avg Deal" value={data.avgDeal ? fmtCurrency(data.avgDeal) : '—'} sub="per won lead" icon={DollarSign} color="bg-amber-100 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Leads by Source</SectionTitle>
          {data.bySource.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.bySource} layout="vertical" margin={{ left: 80, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} tickFormatter={s => SOURCE_LABELS[s] ?? s} width={80} />
                <Tooltip formatter={(v) => [v, 'Leads']} labelFormatter={(s) => SOURCE_LABELS[String(s)] ?? String(s)} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.bySource.map((_, i) => <Cell key={i} fill="#6366f1" fillOpacity={1 - i * 0.1} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Leads by Status</SectionTitle>
          {data.byStatus.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.byStatus} layout="vertical" margin={{ left: 80, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} tickFormatter={capitalize} width={80} />
                <Tooltip formatter={(v) => [v, 'Leads']} labelFormatter={(s) => capitalize(String(s))} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.byStatus.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#6366f1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">All Leads ({data.total})</p>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Name', 'Status', 'Source', 'Value', 'Created'].map(h => <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.leads.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    <Link href={`/leads/${l.id}`} className="hover:text-indigo-600 hover:underline">{l.name}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: (STATUS_COLORS[l.status] ?? '#6366f1') + '20', color: STATUS_COLORS[l.status] ?? '#6366f1' }}>
                      {capitalize(l.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{SOURCE_LABELS[l.source ?? ''] ?? l.source ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700">{l.value ? fmtCurrency(l.value) : '—'}</td>
                  <td className="px-5 py-3 text-slate-400">{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.leads.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No leads in this period</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Time Report ──────────────────────────────────────────────────────────────

interface TimeData {
  totalMin: number; totalEntries: number; uniqueEmployees: number
  byEmployee: { name: string; totalMin: number; byType: Record<string, number> }[]
  byType: { type: string; minutes: number }[]
  byDay: { date: string; minutes: number }[]
  entries: { id: string; type: string; description: string | null; durationMin: number; startedAt: string; assignedTo: string | null; leadName: string | null; leadId: string | null }[]
}

const TYPE_LABELS: Record<string, string> = { call: 'Call', meeting: 'Meeting', work: 'Work', email: 'Email', admin: 'Admin', other: 'Other' }

function TimeReport({ from, to, account }: { from: string; to: string; account?: string }) {
  const [data, setData] = useState<TimeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ from, to, ...(account ? { account } : {}) })
    fetch(`/api/reports/time?${qs}`).then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [from, to, account])

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (!data) return null

  function handleExport() {
    if (!data) return
    const rows = [
      ['Employee', 'Type', 'Lead', 'Description', 'Duration (min)', 'Date'],
      ...data.entries.map(e => [e.assignedTo ?? '', TYPE_LABELS[e.type] ?? e.type, e.leadName ?? '', e.description ?? '', String(e.durationMin), fmtDate(e.startedAt)]),
    ]
    exportCsv(rows, `time-report-${from}-${to}.csv`)
  }

  const allTypes = [...new Set(data.entries.map(e => e.type))]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Hours" value={fmtDuration(data.totalMin)} sub={`${data.totalEntries} entries`} icon={Clock} color="bg-indigo-100 text-indigo-600" />
        <StatCard label="Team Members" value={String(data.uniqueEmployees)} icon={Users} color="bg-purple-100 text-purple-600" />
        <StatCard label="Avg Per Entry" value={data.totalEntries > 0 ? fmtDuration(Math.round(data.totalMin / data.totalEntries)) : '—'} icon={Clock} color="bg-slate-100 text-slate-600" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Hours by Type</SectionTitle>
          {data.byType.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.byType} layout="vertical" margin={{ left: 70, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => fmtDuration(v)} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} tickFormatter={t => TYPE_LABELS[t] ?? t} width={70} />
                <Tooltip formatter={(v) => [fmtDuration(Number(v)), 'Duration']} labelFormatter={(t) => TYPE_LABELS[String(t)] ?? String(t)} />
                <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                  {data.byType.map((t, i) => <Cell key={i} fill={TYPE_COLORS[t.type] ?? '#6366f1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Hours by Employee</SectionTitle>
          {data.byEmployee.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
            <div className="space-y-2.5 overflow-y-auto max-h-44">
              {data.byEmployee.map(emp => (
                <div key={emp.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 truncate">{emp.name}</span>
                    <span className="text-sm font-semibold text-slate-900 ml-2 flex-shrink-0">{fmtDuration(emp.totalMin)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((emp.totalMin / data.totalMin) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employee breakdown table */}
      {data.byEmployee.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">Employee Breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  {allTypes.map(t => <th key={t} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{TYPE_LABELS[t] ?? t}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.byEmployee.map(emp => (
                  <tr key={emp.name} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-900">{emp.name}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{fmtDuration(emp.totalMin)}</td>
                    {allTypes.map(t => (
                      <td key={t} className="px-5 py-3 text-slate-500">{emp.byType[t] ? fmtDuration(emp.byType[t]) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">All Entries ({data.totalEntries})</p>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Employee', 'Type', 'Lead', 'Description', 'Duration', 'Date'].map(h => <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.entries.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-700">{e.assignedTo ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: (TYPE_COLORS[e.type] ?? '#6366f1') + '20', color: TYPE_COLORS[e.type] ?? '#6366f1' }}>
                      {TYPE_LABELS[e.type] ?? e.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {e.leadId ? <Link href={`/leads/${e.leadId}`} className="hover:text-indigo-600 hover:underline">{e.leadName ?? '—'}</Link> : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{e.description ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{fmtDuration(e.durationMin)}</td>
                  <td className="px-5 py-3 text-slate-400">{fmtDate(e.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No entries in this period</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Revenue Report ───────────────────────────────────────────────────────────

interface RevenueData {
  total: number; pipelineTotal: number; wonTotal: number; invoicedTotal: number; outstandingTotal: number
  byStatus: { status: string; count: number; total: number }[]
  byMonth: { month: string; total: number }[]
  quotes: { id: string; number: string; type: string; status: string; total: number; issuedAt: string | null; dueAt: string | null; createdAt: string; leadName: string | null; leadId: string | null }[]
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', accepted: 'Accepted', won: 'Won', lost: 'Lost', cancelled: 'Cancelled',
}

function RevenueReport({ from, to, account }: { from: string; to: string; account?: string }) {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ from, to, ...(account ? { account } : {}) })
    fetch(`/api/reports/revenue?${qs}`).then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [from, to, account])

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (!data) return null

  function handleExport() {
    if (!data) return
    const rows = [
      ['Number', 'Type', 'Status', 'Lead', 'Total', 'Issued', 'Due', 'Created'],
      ...data.quotes.map(q => [q.number, capitalize(q.type), QUOTE_STATUS_LABELS[q.status] ?? q.status, q.leadName ?? '', fmtCurrency(q.total), q.issuedAt ? fmtDate(q.issuedAt) : '', q.dueAt ? fmtDate(q.dueAt) : '', fmtDate(q.createdAt)]),
    ]
    exportCsv(rows, `revenue-report-${from}-${to}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Pipeline" value={fmtCurrency(data.pipelineTotal)} sub={`${data.total} quotes/invoices`} icon={TrendingUp} color="bg-indigo-100 text-indigo-600" />
        <StatCard label="Won / Accepted" value={fmtCurrency(data.wonTotal)} icon={DollarSign} color="bg-emerald-100 text-emerald-600" />
        <StatCard label="Invoiced" value={fmtCurrency(data.invoicedTotal)} icon={DollarSign} color="bg-blue-100 text-blue-600" />
        <StatCard label="Outstanding" value={fmtCurrency(data.outstandingTotal)} sub="sent, unpaid invoices" icon={Clock} color="bg-amber-100 text-amber-600" />
      </div>

      {data.byMonth.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Monthly Pipeline</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.byMonth} margin={{ left: 10, right: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={m => { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }) }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [fmtCurrency(Number(v)), 'Total']} labelFormatter={(m) => { const [y, mo] = String(m).split('-'); return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) }} />
              <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">All Quotes &amp; Invoices ({data.total})</p>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Number', 'Type', 'Status', 'Lead', 'Total', 'Due', 'Created'].map(h => <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.quotes.map(q => (
                <tr key={q.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">{q.number}</td>
                  <td className="px-5 py-3 text-slate-500">{capitalize(q.type)}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: (STATUS_COLORS[q.status] ?? '#94a3b8') + '20', color: STATUS_COLORS[q.status] ?? '#94a3b8' }}>
                      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {q.leadId ? <Link href={`/leads/${q.leadId}`} className="hover:text-indigo-600 hover:underline">{q.leadName ?? '—'}</Link> : '—'}
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{fmtCurrency(q.total)}</td>
                  <td className="px-5 py-3 text-slate-400">{q.dueAt ? fmtDate(q.dueAt) : '—'}</td>
                  <td className="px-5 py-3 text-slate-400">{fmtDate(q.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.quotes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No quotes or invoices in this period</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Bookings Report ──────────────────────────────────────────────────────────

interface BookingsData {
  totalBookings: number; services: number; topService: string | null; cancelled: number; bookedValue: number
  byService: { service: string; count: number; revenue: number; cancelled: number }[]
  byStatus: { status: string; count: number }[]
  bookings: { id: string; service: string; status: string; price: number | null; when: string; leadName: string | null; leadId: string | null }[]
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: '#6366f1' },
  completed: { label: 'Completed', color: '#10b981' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  no_show: { label: 'No-show', color: '#f59e0b' },
}
const SERVICE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#a855f7', '#f97316', '#0ea5e9', '#84cc16']

function BookingsReport({ from, to, account }: { from: string; to: string; account?: string }) {
  const [data, setData] = useState<BookingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ from, to, ...(account ? { account } : {}) })
    fetch(`/api/reports/bookings?${qs}`).then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [from, to, account])

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (!data) return null

  function handleExport() {
    if (!data) return
    const rows = [
      ['Service', 'Bookings', 'Cancelled', 'Booked value'],
      ...data.byService.map(s => [s.service, String(s.count), String(s.cancelled), s.revenue ? String(s.revenue) : '']),
    ]
    exportCsv(rows, `bookings-by-service-${from}-${to}.csv`)
  }

  const chartData = data.byService.filter(s => s.count > 0).slice(0, 12)
  const chartHeight = Math.max(160, chartData.length * 34)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Bookings" value={String(data.totalBookings)} sub="excludes cancelled" icon={CalendarDays} color="bg-indigo-100 text-indigo-600" />
        <StatCard label="Services Booked" value={String(data.services)} icon={TrendingUp} color="bg-purple-100 text-purple-600" />
        <StatCard label="Most Popular" value={data.topService ?? '—'} icon={TrendingUp} color="bg-emerald-100 text-emerald-600" />
        <StatCard label="Cancelled" value={String(data.cancelled)} sub={data.bookedValue ? `${fmtCurrency(data.bookedValue)} booked` : undefined} icon={Clock} color="bg-amber-100 text-amber-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Bookings by Service</SectionTitle>
        {chartData.length === 0 ? <p className="text-sm text-slate-400">No bookings in this period</p> : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 110, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="service" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v, _n, p) => [`${v} booking${Number(v) === 1 ? '' : 's'}${p?.payload?.revenue ? ` · ${fmtCurrency(p.payload.revenue)}` : ''}`, 'Bookings']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={SERVICE_COLORS[i % SERVICE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">Services ({data.byService.length})</p>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Service', 'Bookings', 'Cancelled', 'Booked Value'].map(h => <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.byService.map((s, i) => (
                <tr key={s.service} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SERVICE_COLORS[i % SERVICE_COLORS.length] }} />
                    {s.service}
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{s.count}</td>
                  <td className="px-5 py-3 text-slate-400">{s.cancelled || '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{s.revenue ? fmtCurrency(s.revenue) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.byService.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No bookings in this period</p>}
        </div>
      </div>

      {data.bookings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">Recent Bookings</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Service', 'Status', 'Customer', 'Price', 'Date'].map(h => <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.bookings.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-900">{b.service}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: (BOOKING_STATUS[b.status]?.color ?? '#94a3b8') + '20', color: BOOKING_STATUS[b.status]?.color ?? '#94a3b8' }}>
                        {BOOKING_STATUS[b.status]?.label ?? capitalize(b.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {b.leadId ? <Link href={`/leads/${b.leadId}`} className="hover:text-indigo-600 hover:underline">{b.leadName ?? '—'}</Link> : (b.leadName ?? '—')}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{b.price ? fmtCurrency(b.price) : '—'}</td>
                    <td className="px-5 py-3 text-slate-400">{fmtDate(b.when)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'leads' | 'time' | 'revenue' | 'bookings'
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'leads', label: 'Lead Pipeline', icon: Users },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays },
  { id: 'time', label: 'Time Tracking', icon: Clock },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
]

export default function ReportsPage() {
  const sp = useSearchParams()
  const account = sp.get('account') ?? undefined

  const [tab, setTab] = useState<Tab>('leads')
  const [preset, setPreset] = useState<Preset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const { from, to } = useCustom && customFrom && customTo
    ? { from: customFrom, to: customTo }
    : presetRange(preset)

  const PRESETS: { id: Preset; label: string }[] = [
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
    { id: 'ytd', label: 'Year to date' },
    { id: 'all', label: 'All time' },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1 text-sm">Lead pipeline, bookings, time tracking, and revenue</p>
        </div>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Period</span>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => { setPreset(p.id); setUseCustom(false) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!useCustom && preset === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setUseCustom(true) }}
            className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <span className="text-slate-400 text-sm">–</span>
          <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setUseCustom(true) }}
            className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'leads' && <LeadsReport from={from} to={to} account={account} />}
      {tab === 'bookings' && <BookingsReport from={from} to={to} account={account} />}
      {tab === 'time' && <TimeReport from={from} to={to} account={account} />}
      {tab === 'revenue' && <RevenueReport from={from} to={to} account={account} />}
    </div>
  )
}
