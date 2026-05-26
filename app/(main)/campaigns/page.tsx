'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Mail, Send, Clock, FileText, Trash2, Loader2, BarChart2, Eye, MousePointer, XCircle, Copy, AlertCircle } from 'lucide-react'

type Campaign = {
  id: string; name: string; subject: string; status: string
  totalSent: number; totalFailed: number; sentAt: string | null
  scheduledAt: string | null; createdAt: string; trackOpens: boolean
  lastError: string | null
  _count: { sends: number }
}

type OverallStats = {
  sentCampaigns: number
  totalDelivered: number
  totalFailed: number
  totalOpens: number
  totalClicks: number
  openRate: number | null
  clickRate: number | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600',   icon: FileText },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700',     icon: Clock    },
  sending:   { label: 'Sending',   color: 'bg-yellow-100 text-yellow-700', icon: Loader2  },
  sent:      { label: 'Sent',      color: 'bg-green-100 text-green-700',   icon: Send     },
  failed:    { label: 'Failed',    color: 'bg-red-100 text-red-700',       icon: XCircle  },
}

const FILTER_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'draft',    label: 'Drafts' },
  { key: 'sent',     label: 'Sent' },
  { key: 'failed',   label: 'Failed' },
  { key: 'scheduled',label: 'Scheduled' },
]

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState<OverallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/campaigns').then((r) => r.json()),
      fetch('/api/campaigns/stats').then((r) => r.json()),
    ]).then(([list, s]) => {
      if (Array.isArray(list)) setCampaigns(list)
      if (s && !s.error) setStats(s)
    }).finally(() => setLoading(false))
  }, [])

  async function deleteCampaign(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    setDeleting(null)
  }

  async function duplicateCampaign(id: string) {
    setDuplicating(id)
    const res = await fetch(`/api/campaigns/${id}/duplicate`, { method: 'POST' })
    if (res.ok) {
      const copy = await res.json()
      router.push(`/campaigns/${copy.id}`)
    }
    setDuplicating(null)
  }

  const filtered = filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter)

  const counts = {
    all: campaigns.length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    sent: campaigns.filter((c) => c.status === 'sent').length,
    failed: campaigns.filter((c) => c.status === 'failed').length,
    scheduled: campaigns.filter((c) => c.status === 'scheduled').length,
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-1">Email broadcasts to your leads and clients</p>
        </div>
        <Link href="/campaigns/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Campaign
        </Link>
      </div>

      {stats && stats.sentCampaigns > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Send className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-slate-900">{stats.sentCampaigns}</p>
            <p className="text-xs text-slate-500 mt-0.5">Campaigns Sent</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Mail className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-slate-900">{stats.totalDelivered.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Emails Delivered</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 ${stats.openRate !== null ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Eye className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-slate-900">{stats.openRate !== null ? `${stats.openRate}%` : '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.openRate !== null ? `Open Rate (${stats.totalOpens.toLocaleString()})` : 'Opens Not Tracked'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 ${stats.clickRate !== null ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
              <MousePointer className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-slate-900">{stats.clickRate !== null ? `${stats.clickRate}%` : '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.clickRate !== null ? `Click Rate (${stats.totalClicks.toLocaleString()})` : 'Clicks Not Tracked'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 ${stats.totalFailed > 0 ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400'}`}>
              <XCircle className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-slate-900">{stats.totalFailed.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Failed</p>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-indigo-500" />
          </div>
          <h2 className="font-semibold text-slate-900 mb-1">No campaigns yet</h2>
          <p className="text-slate-500 text-sm mb-5">Send offers, updates and seasonal emails to your leads</p>
          <Link href="/campaigns/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-slate-100 overflow-x-auto">
            {FILTER_TABS.filter(t => t.key === 'all' || counts[t.key as keyof typeof counts] > 0).map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  filter === t.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                {counts[t.key as keyof typeof counts] > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    filter === t.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                  }`}>{counts[t.key as keyof typeof counts]}</span>
                )}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No {filter} campaigns</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Sent</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => {
                  const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft
                  const Icon = cfg.icon
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link href={`/campaigns/${c.id}`} className="block">
                          <p className="font-medium text-slate-900 truncate max-w-xs group-hover:text-indigo-600 transition-colors">{c.name}</p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{c.subject || <em className="text-slate-300">No subject</em>}</p>
                        </Link>
                        {c.lastError && (
                          <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5 max-w-sm">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{c.lastError}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                          <Icon className={`w-3 h-3 ${c.status === 'sending' ? 'animate-spin' : ''}`} />
                          {cfg.label}
                        </span>
                        {c.status === 'scheduled' && c.scheduledAt && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(c.scheduledAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right hidden md:table-cell">
                        {c.status === 'sent' ? (
                          <div>
                            <p className="font-medium text-slate-800">{c.totalSent.toLocaleString()}</p>
                            {c.totalFailed > 0 && <p className="text-xs text-red-500">{c.totalFailed} failed</p>}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right hidden lg:table-cell text-xs text-slate-400">
                        {c.sentAt
                          ? new Date(c.sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                          : new Date(c.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          {c.status === 'sent' && (
                            <Link href={`/campaigns/${c.id}`} title="View stats"
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                              <BarChart2 className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          <button
                            onClick={() => duplicateCampaign(c.id)}
                            disabled={duplicating === c.id}
                            title="Duplicate"
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            {duplicating === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => deleteCampaign(c.id, c.name)} disabled={deleting === c.id}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            {deleting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
