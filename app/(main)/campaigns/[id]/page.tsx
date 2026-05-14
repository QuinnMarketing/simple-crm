'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Clock, CheckCircle, XCircle, MousePointer, Eye, Loader2, Mail, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CampaignEditor from '../CampaignEditor'

type CampaignSend = {
  id: string; email: string; name: string | null; status: string
  openedAt: string | null; clickedAt: string | null; sentAt: string | null; error: string | null
}

type Campaign = {
  id: string; name: string; subject: string; bodyHtml: string; bodyText: string
  status: string; totalSent: number; totalFailed: number; sentAt: string | null
  scheduledAt: string | null; trackOpens: boolean; trackClicks: boolean
  segmentFilter: string; createdAt: string; accountId: string | null; sends: CampaignSend[]
}

function RateBar({ label, value, max, color, count }: { label: string; value: number; max: number; color: string; count: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-900 font-bold">{Math.round(pct)}% <span className="text-slate-400 font-normal text-xs">({count})</span></span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FunnelStep({ label, value, total, color, icon: Icon }: { label: string; value: number; total: number; color: string; icon: React.ElementType }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-sm font-bold text-slate-900">{value.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color.replace('text-', 'bg-').replace('bg-', 'bg-').replace('-100', '-400').replace('-600', '-400')}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
    </div>
  )
}

function buildHourlyData(sends: CampaignSend[], sentAt: string | null) {
  if (!sentAt) return []
  const base = new Date(sentAt).getTime()
  const buckets: Record<number, { hour: string; opens: number; clicks: number }> = {}
  for (const s of sends) {
    for (const [key, ts] of [['opens', s.openedAt], ['clicks', s.clickedAt]] as const) {
      if (!ts) continue
      const h = Math.floor((new Date(ts).getTime() - base) / 3_600_000)
      if (h < 0 || h > 47) continue
      if (!buckets[h]) buckets[h] = { hour: `+${h}h`, opens: 0, clicks: 0 }
      buckets[h][key]++
    }
  }
  if (Object.keys(buckets).length === 0) return []
  const maxH = Math.max(...Object.keys(buckets).map(Number))
  return Array.from({ length: maxH + 1 }, (_, h) => buckets[h] ?? { hour: `+${h}h`, opens: 0, clicks: 0 })
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'analytics' | 'recipients' | 'edit'>('analytics')

  useEffect(() => {
    fetch(`/api/campaigns/${id}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) setCampaign(d)
    }).finally(() => setLoading(false))
  }, [id])

  const stats = useMemo(() => {
    if (!campaign) return null
    const opens = campaign.sends.filter((s) => s.openedAt).length
    const clicks = campaign.sends.filter((s) => s.clickedAt).length
    const delivered = campaign.totalSent
    const failed = campaign.sends.filter((s) => s.status === 'failed').length
    const sent = delivered + failed
    return { opens, clicks, delivered, failed, sent }
  }, [campaign])

  const hourlyData = useMemo(() => {
    if (!campaign) return []
    return buildHourlyData(campaign.sends, campaign.sentAt)
  }, [campaign])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }
  if (!campaign || !stats) return <div className="text-slate-500">Campaign not found.</div>

  const isSent = campaign.status === 'sent'

  const TABS = [
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart2 },
    { id: 'recipients' as const, label: 'Recipients', icon: Mail },
    ...(!isSent ? [{ id: 'edit' as const, label: 'Edit', icon: Send }] : []),
  ]

  return (
    <div>
      <div className="mb-6">
        <Link href="/campaigns" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
            <p className="text-slate-400 text-sm mt-0.5 truncate max-w-lg">{campaign.subject}</p>
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
          <div className="flex border border-slate-200 rounded-lg overflow-hidden text-sm">
            {TABS.map(({ id: tid, label }) => (
              <button key={tid} onClick={() => setTab(tid)}
                className={`px-4 py-2 font-medium transition-colors ${tab === tid ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'edit' && !isSent ? (
        <CampaignEditor
          campaignId={campaign.id}
          accountId={campaign.accountId}
          initial={{
            name: campaign.name, subject: campaign.subject,
            bodyHtml: campaign.bodyHtml, bodyText: campaign.bodyText,
            segmentFilter: campaign.segmentFilter, trackOpens: campaign.trackOpens,
            trackClicks: campaign.trackClicks, scheduledAt: campaign.scheduledAt,
            status: campaign.status,
          }}
        />
      ) : tab === 'recipients' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recipients</h2>
            <p className="text-xs text-slate-400 mt-0.5">{campaign.sends.length} total</p>
          </div>
          {campaign.sends.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No sends yet</div>
          ) : (
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
                          {s.openedAt ? (
                            <div>
                              <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                              <p className="text-xs text-slate-400 mt-0.5">{new Date(s.openedAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      )}
                      {campaign.trackClicks && (
                        <td className="px-4 py-2.5 text-center">
                          {s.clickedAt ? (
                            <div>
                              <CheckCircle className="w-4 h-4 text-blue-500 mx-auto" />
                              <p className="text-xs text-slate-400 mt-0.5">{new Date(s.clickedAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Analytics tab */
        <div className="space-y-5">
          {!isSent ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <Send className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No analytics yet</p>
              <p className="text-slate-400 text-sm mt-1">Send or schedule this campaign to see results</p>
            </div>
          ) : (
            <>
              {/* Top stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                    <Send className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stats.delivered.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Delivered</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 ${campaign.trackOpens ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Eye className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {campaign.trackOpens ? `${stats.delivered > 0 ? Math.round((stats.opens / stats.delivered) * 100) : 0}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{campaign.trackOpens ? `Open rate (${stats.opens})` : 'Opens not tracked'}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 ${campaign.trackClicks ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <MousePointer className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {campaign.trackClicks ? `${stats.delivered > 0 ? Math.round((stats.clicks / stats.delivered) * 100) : 0}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{campaign.trackClicks ? `Click rate (${stats.clicks})` : 'Clicks not tracked'}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 ${stats.failed > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                    <XCircle className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stats.failed}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Failed</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Engagement funnel */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-900 mb-4">Engagement Funnel</h2>
                  <div className="space-y-4">
                    <FunnelStep label="Sent" value={stats.sent} total={stats.sent} color="bg-slate-100 text-slate-500" icon={Send} />
                    <FunnelStep label="Delivered" value={stats.delivered} total={stats.sent} color="bg-indigo-100 text-indigo-600" icon={CheckCircle} />
                    {campaign.trackOpens && (
                      <FunnelStep label="Opened" value={stats.opens} total={stats.sent} color="bg-emerald-100 text-emerald-600" icon={Eye} />
                    )}
                    {campaign.trackClicks && (
                      <FunnelStep label="Clicked" value={stats.clicks} total={stats.sent} color="bg-blue-100 text-blue-600" icon={MousePointer} />
                    )}
                  </div>
                </div>

                {/* Rate comparison bars */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-900 mb-4">Engagement Rates</h2>
                  <div className="space-y-5">
                    <RateBar label="Delivery rate" value={stats.delivered} max={stats.sent} color="bg-indigo-400" count={stats.delivered} />
                    {campaign.trackOpens
                      ? <RateBar label="Open rate" value={stats.opens} max={stats.delivered} color="bg-emerald-400" count={stats.opens} />
                      : <div className="text-xs text-slate-400 italic">Open tracking not enabled</div>
                    }
                    {campaign.trackClicks
                      ? <RateBar label="Click rate" value={stats.clicks} max={stats.delivered} color="bg-blue-400" count={stats.clicks} />
                      : <div className="text-xs text-slate-400 italic">Click tracking not enabled</div>
                    }
                    {campaign.trackOpens && stats.opens > 0 && (
                      <RateBar label="Click-to-open rate" value={stats.clicks} max={stats.opens} color="bg-purple-400" count={stats.clicks} />
                    )}
                    {stats.failed > 0 && (
                      <RateBar label="Failure rate" value={stats.failed} max={stats.sent} color="bg-red-400" count={stats.failed} />
                    )}
                  </div>
                </div>
              </div>

              {/* Hourly engagement chart */}
              {hourlyData.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-900 mb-1">Engagement Over Time</h2>
                  <p className="text-xs text-slate-400 mb-4">Hours after send</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hourlyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      {campaign.trackOpens && <Bar dataKey="opens" name="Opens" fill="#34d399" radius={[3, 3, 0, 0]} />}
                      {campaign.trackClicks && <Bar dataKey="clicks" name="Clicks" fill="#60a5fa" radius={[3, 3, 0, 0]} />}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
