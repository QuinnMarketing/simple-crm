'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Clock, CheckCircle, XCircle, MousePointer, Eye, Loader2 } from 'lucide-react'
import CampaignEditor from '../CampaignEditor'

type Send = {
  id: string; email: string; name: string | null; status: string
  openedAt: string | null; clickedAt: string | null; sentAt: string | null; error: string | null
}

type Campaign = {
  id: string; name: string; subject: string; bodyHtml: string; bodyText: string
  status: string; totalSent: number; totalFailed: number; sentAt: string | null
  scheduledAt: string | null; trackOpens: boolean; trackClicks: boolean
  segmentFilter: string; createdAt: string; accountId: string | null; sends: Send[]
}

function StatCard({ value, label, icon: Icon, color }: { value: number | string; label: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stats' | 'edit'>('stats')

  useEffect(() => {
    fetch(`/api/campaigns/${id}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) setCampaign(d)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }
  if (!campaign) return <div className="text-slate-500">Campaign not found.</div>

  const opens = campaign.sends.filter((s) => s.openedAt).length
  const clicks = campaign.sends.filter((s) => s.clickedAt).length
  const failed = campaign.sends.filter((s) => s.status === 'failed').length
  const openRate = campaign.totalSent > 0 ? Math.round((opens / campaign.totalSent) * 100) : 0
  const isSent = campaign.status === 'sent'

  return (
    <div>
      <div className="mb-6">
        <Link href="/campaigns" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
            {isSent && campaign.sentAt && (
              <p className="text-slate-500 text-sm mt-1">
                Sent {new Date(campaign.sentAt).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {campaign.status === 'scheduled' && campaign.scheduledAt && (
              <p className="text-blue-600 text-sm mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Scheduled for {new Date(campaign.scheduledAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {!isSent && (
            <div className="flex border border-slate-200 rounded-lg overflow-hidden text-sm">
              <button onClick={() => setTab('stats')}
                className={`px-4 py-2 font-medium transition-colors ${tab === 'stats' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                Overview
              </button>
              <button onClick={() => setTab('edit')}
                className={`px-4 py-2 font-medium transition-colors ${tab === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {(tab === 'edit' && !isSent) ? (
        <CampaignEditor
          campaignId={campaign.id}
          accountId={campaign.accountId}
          initial={{
            name: campaign.name,
            subject: campaign.subject,
            bodyHtml: campaign.bodyHtml,
            bodyText: campaign.bodyText,
            segmentFilter: campaign.segmentFilter,
            trackOpens: campaign.trackOpens,
            trackClicks: campaign.trackClicks,
            scheduledAt: campaign.scheduledAt,
            status: campaign.status,
          }}
        />
      ) : (
        <div className="space-y-5">
          {/* Stats */}
          {isSent && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard value={campaign.totalSent} label="Delivered" icon={Send} color="bg-indigo-100 text-indigo-600" />
              {campaign.trackOpens
                ? <StatCard value={`${openRate}%`} label={`Opened (${opens})`} icon={Eye} color="bg-emerald-100 text-emerald-600" />
                : <StatCard value="—" label="Opens (not tracked)" icon={Eye} color="bg-slate-100 text-slate-400" />
              }
              {campaign.trackClicks
                ? <StatCard value={clicks} label="Clicks" icon={MousePointer} color="bg-blue-100 text-blue-600" />
                : <StatCard value="—" label="Clicks (not tracked)" icon={MousePointer} color="bg-slate-100 text-slate-400" />
              }
              <StatCard value={failed} label="Failed" icon={XCircle} color={failed > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'} />
            </div>
          )}

          {/* Recipients */}
          {campaign.sends.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Recipients</h2>
                <p className="text-xs text-slate-400 mt-0.5">{campaign.sends.length} total</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Recipient</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                      {campaign.trackOpens && <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Opened</th>}
                      {campaign.trackClicks && <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Clicked</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {campaign.sends.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-slate-800">{s.name ?? s.email}</p>
                          {s.name && <p className="text-xs text-slate-400">{s.email}</p>}
                          {s.error && <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs">{s.error}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{s.status}</span>
                        </td>
                        {campaign.trackOpens && (
                          <td className="px-4 py-2.5 text-center">
                            {s.openedAt
                              ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        )}
                        {campaign.trackClicks && (
                          <td className="px-4 py-2.5 text-center">
                            {s.clickedAt
                              ? <CheckCircle className="w-4 h-4 text-blue-500 mx-auto" />
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!isSent && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <p className="text-sm">No sends yet — switch to Edit to send this campaign</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
