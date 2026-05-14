'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp, Loader2, AlertCircle, Settings } from 'lucide-react'
import Link from 'next/link'

type LeadSource = { source: string; count: number }
type DayLeads = { date: string; count: number }
type GA4Data = {
  sessions: number; users: number; pageViews: number
  byDay: { date: string; sessions: number; users: number }[]
}
type AdCampaign = { name: string; impressions: number; clicks: number; spend: number; conversions?: number; leads?: number }
type GoogleAdsData = { spend: number; impressions: number; clicks: number; conversions: number; campaigns: AdCampaign[] }
type MetaAdsData = { spend: number; impressions: number; clicks: number; leads: number; campaigns: AdCampaign[] }
type AnalyticsData = {
  period: number
  crmLeads: { total: number; bySource: LeadSource[]; byDay: DayLeads[] }
  ga4: GA4Data | null
  googleAds: GoogleAdsData | null
  metaAds: MetaAdsData | null
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website', referral: 'Referral', google_ads: 'Google Ads',
  facebook_ads: 'Facebook', cold_outreach: 'Cold Outreach',
  webhook: 'Webhook', other: 'Other', direct: 'Direct',
}
const SOURCE_COLORS: Record<string, string> = {
  google_ads: '#4285F4', facebook_ads: '#1877F2', website: '#6366f1',
  referral: '#22c55e', cold_outreach: '#f59e0b', webhook: '#8b5cf6',
  other: '#94a3b8', direct: '#64748b',
}

function fmtAUD(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-AU')
}
function fmtGA4Date(d: string) {
  return new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function StatCard({ label, value, sub, dim }: { label: string; value: string; sub?: string; dim?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${dim ? 'text-slate-400' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
}

function CampaignTable({ campaigns, cols }: {
  campaigns: AdCampaign[]
  cols: { key: string; label: string; fmt: (c: AdCampaign) => string }[]
}) {
  if (campaigns.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-50">
            <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Campaign</th>
            {cols.map((c) => (
              <th key={c.key} className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide last:pr-5">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {campaigns.map((c) => (
            <tr key={c.name} className="hover:bg-slate-50 transition-colors">
              <td className="px-5 py-2.5 font-medium text-slate-800 truncate max-w-xs">{c.name}</td>
              {cols.map((col) => (
                <td key={col.key} className="px-4 py-2.5 text-right tabular-nums text-slate-700 last:pr-5">{col.fmt(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AnalyticsPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ days: String(days) })
      if (accountParam) params.set('account', accountParam)
      const res = await fetch(`/api/analytics/data?${params}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [days, accountParam])

  useEffect(() => { fetchData() }, [fetchData])

  const totalAdSpend = (data?.googleAds?.spend ?? 0) + (data?.metaAds?.spend ?? 0)
  const blendedCpl = data && data.crmLeads.total > 0 && totalAdSpend > 0
    ? totalAdSpend / data.crmLeads.total
    : null
  const tickInterval = days <= 7 ? 0 : days <= 30 ? 4 : 13

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Marketing performance and lead attribution</p>
        </div>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden text-sm">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-4 py-2 font-medium transition-colors ${days === d ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && data && (
        <div className="space-y-5">
          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Leads" value={String(data.crmLeads.total)} sub={`Last ${days} days`} />
            <StatCard
              label="Website Sessions"
              value={data.ga4 ? fmtNum(data.ga4.sessions) : '—'}
              sub={data.ga4 ? `${fmtNum(data.ga4.users)} users` : 'GA4 not connected'}
              dim={!data.ga4}
            />
            <StatCard
              label="Total Ad Spend"
              value={totalAdSpend > 0 ? fmtAUD(totalAdSpend) : '—'}
              sub={totalAdSpend > 0 ? 'Google Ads + Meta' : 'Ads not connected'}
              dim={totalAdSpend === 0}
            />
            <StatCard
              label="Blended CPL"
              value={blendedCpl != null ? fmtAUD(blendedCpl) : '—'}
              sub={blendedCpl != null ? 'per lead (all channels)' : undefined}
              dim={blendedCpl == null}
            />
          </div>

          {/* Lead sources + trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SectionHeader title="Leads by Source" />
              {data.crmLeads.bySource.length === 0 ? (
                <p className="text-sm text-slate-400 py-10 text-center">No leads in this period</p>
              ) : (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={Math.max(data.crmLeads.bySource.length * 44, 120)}>
                    <BarChart
                      data={data.crmLeads.bySource.map((s) => ({ ...s, label: SOURCE_LABELS[s.source] ?? s.source }))}
                      layout="vertical"
                      margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" width={84} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => [v, 'Leads']} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {data.crmLeads.bySource.map((s) => (
                          <Cell key={s.source} fill={SOURCE_COLORS[s.source] ?? '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SectionHeader title="Lead Volume Over Time" />
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={data.crmLeads.byDay.map((d) => ({ ...d, label: fmtDate(d.date) }))}
                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={tickInterval} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => [v, 'Leads']} />
                    <Area type="monotone" dataKey="count" name="Leads" stroke="#6366f1" strokeWidth={2} fill="url(#gradLeads)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* GA4 Traffic */}
          {data.ga4 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Website Traffic (GA4)" />
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>Sessions: <span className="font-semibold text-slate-700">{fmtNum(data.ga4.sessions)}</span></span>
                  <span>Users: <span className="font-semibold text-slate-700">{fmtNum(data.ga4.users)}</span></span>
                  <span>Pageviews: <span className="font-semibold text-slate-700">{fmtNum(data.ga4.pageViews)}</span></span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={data.ga4.byDay.map((d) => ({ ...d, label: fmtGA4Date(d.date) }))}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={tickInterval} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#3b82f6" strokeWidth={2} fill="url(#gradSessions)" dot={false} />
                  <Area type="monotone" dataKey="users" name="Users" stroke="#22c55e" strokeWidth={2} fill="url(#gradUsers)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-1 justify-end">
                {[{ label: 'Sessions', color: '#3b82f6' }, { label: 'Users', color: '#22c55e' }].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                    <span className="text-xs text-slate-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Google Ads */}
          {data.googleAds && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <SectionHeader title="Google Ads" />
                {data.googleAds.spend > 0 && data.crmLeads.bySource.find(s => s.source === 'google_ads') && (
                  <span className="text-xs text-slate-500">
                    CPL: <span className="font-semibold text-slate-700">
                      {fmtAUD(data.googleAds.spend / (data.crmLeads.bySource.find(s => s.source === 'google_ads')?.count ?? 1))}
                    </span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                {([
                  { label: 'Spend', value: fmtAUD(data.googleAds.spend) },
                  { label: 'Impressions', value: fmtNum(data.googleAds.impressions) },
                  { label: 'Clicks', value: fmtNum(data.googleAds.clicks) },
                  { label: 'Conversions', value: data.googleAds.conversions.toFixed(1) },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <div key={label} className="px-5 py-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <CampaignTable
                campaigns={data.googleAds.campaigns}
                cols={[
                  { key: 'spend', label: 'Spend', fmt: (c) => fmtAUD(c.spend) },
                  { key: 'impressions', label: 'Impr.', fmt: (c) => fmtNum(c.impressions) },
                  { key: 'clicks', label: 'Clicks', fmt: (c) => fmtNum(c.clicks) },
                  { key: 'ctr', label: 'CTR', fmt: (c) => c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : '—' },
                  { key: 'conv', label: 'Conv.', fmt: (c) => (c.conversions ?? 0).toFixed(1) },
                ]}
              />
            </div>
          )}

          {/* Meta Ads */}
          {data.metaAds && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <SectionHeader title="Meta Ads" />
                {data.metaAds.spend > 0 && data.metaAds.leads > 0 && (
                  <span className="text-xs text-slate-500">
                    CPL: <span className="font-semibold text-slate-700">{fmtAUD(data.metaAds.spend / data.metaAds.leads)}</span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                {([
                  { label: 'Spend', value: fmtAUD(data.metaAds.spend) },
                  { label: 'Impressions', value: fmtNum(data.metaAds.impressions) },
                  { label: 'Clicks', value: fmtNum(data.metaAds.clicks) },
                  { label: 'Leads', value: String(data.metaAds.leads) },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <div key={label} className="px-5 py-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <CampaignTable
                campaigns={data.metaAds.campaigns}
                cols={[
                  { key: 'spend', label: 'Spend', fmt: (c) => fmtAUD(c.spend) },
                  { key: 'impressions', label: 'Impr.', fmt: (c) => fmtNum(c.impressions) },
                  { key: 'clicks', label: 'Clicks', fmt: (c) => fmtNum(c.clicks) },
                  { key: 'ctr', label: 'CTR', fmt: (c) => c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : '—' },
                  { key: 'leads', label: 'Leads', fmt: (c) => String(c.leads ?? 0) },
                ]}
              />
            </div>
          )}

          {/* Setup prompt */}
          {!data.ga4 && !data.googleAds && !data.metaAds && (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">Connect your analytics platforms</p>
              <p className="text-sm text-slate-500 mt-1 mb-5 max-w-sm mx-auto">
                Link Google Analytics 4, Google Ads, or Meta Ads to see traffic, spend, and cost-per-lead data alongside your CRM leads.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Settings className="w-4 h-4" /> Settings → Integrations
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
