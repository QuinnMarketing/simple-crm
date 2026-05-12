'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Mail, Send, Clock, FileText, Trash2, Loader2, BarChart2 } from 'lucide-react'

type Campaign = {
  id: string; name: string; subject: string; status: string
  totalSent: number; totalFailed: number; sentAt: string | null
  scheduledAt: string | null; createdAt: string; trackOpens: boolean
  _count: { sends: number }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600',   icon: FileText },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700',     icon: Clock    },
  sending:   { label: 'Sending',   color: 'bg-yellow-100 text-yellow-700', icon: Loader2  },
  sent:      { label: 'Sent',      color: 'bg-green-100 text-green-700',   icon: Send     },
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/campaigns').then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setCampaigns(d)
    }).finally(() => setLoading(false))
  }, [])

  async function deleteCampaign(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    setDeleting(null)
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Sent</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {campaigns.map((c) => {
                const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft
                const Icon = cfg.icon
                const openRate = c.totalSent > 0 && c.trackOpens
                  ? `—` // opens tracked per send record — shown in detail
                  : null

                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <Link href={`/campaigns/${c.id}`} className="block">
                        <p className="font-medium text-slate-900 truncate max-w-xs group-hover:text-indigo-600 transition-colors">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{c.subject || <em className="text-slate-300">No subject</em>}</p>
                      </Link>
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
        </div>
      )}
    </div>
  )
}
