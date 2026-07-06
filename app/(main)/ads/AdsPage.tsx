'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Target, RefreshCw, Loader2, Plus, Trash2, Play, Pause, ExternalLink,
  Users, DollarSign, TrendingUp, MousePointer, Eye, ChevronRight,
  CheckCircle2, XCircle, Clock, AlertCircle, ArrowRight, Upload,
  Info, X, ChevronDown,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdPlatformAccount {
  id: string
  platform: 'google_ads' | 'meta_ads' | 'tiktok_ads'
  platformAccountId: string
  platformAccountName: string
  currencyCode: string
  timezone: string
  enabled: boolean
  syncedAt: string | null
  createdAt: string
}

interface AdCampaign {
  id: string
  platform: string
  name: string
  status: string
  objective: string | null
  budgetType: string | null
  budgetAmount: number | null
  startDate: string | null
  endDate: string | null
  syncedAt: string | null
  adPlatformAccount?: { platformAccountName: string }
}

interface PerfSummary {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversionValue: number
  ctr: number
  cpc: number
  cpm: number
  roas: number
  cpl: number
}

interface TimeSeriesRow {
  date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
}

interface AdAudience {
  id: string
  platform: string
  name: string
  description: string | null
  memberCount: number
  status: string
  uploadedAt: string | null
  createdAt: string
  adPlatformAccount: { platformAccountName: string; platform: string }
}

interface AttributionLead {
  id: string
  name: string
  email: string | null
  status: string
  value: number | null
  platform: string | null
  campaignName: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  createdAt: string
}

// ─── Platform meta ────────────────────────────────────────────────────────────

const PLATFORM_META = {
  google_ads: { label: 'Google Ads', color: '#4285F4', bgColor: 'bg-blue-500', borderColor: 'border-blue-200', textColor: 'text-blue-700', badge: 'bg-blue-50' },
  meta_ads: { label: 'Meta Ads', color: '#1877F2', bgColor: 'bg-indigo-600', borderColor: 'border-indigo-200', textColor: 'text-indigo-700', badge: 'bg-indigo-50' },
  tiktok_ads: { label: 'TikTok Ads', color: '#000000', bgColor: 'bg-slate-800', borderColor: 'border-slate-200', textColor: 'text-slate-700', badge: 'bg-slate-100' },
}

const STATUS_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  active: { icon: <Play className="w-3 h-3" />, label: 'Active', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  enabled: { icon: <Play className="w-3 h-3" />, label: 'Active', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  paused: { icon: <Pause className="w-3 h-3" />, label: 'Paused', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  removed: { icon: <XCircle className="w-3 h-3" />, label: 'Removed', color: 'text-red-600 bg-red-50 border-red-200' },
  archived: { icon: <XCircle className="w-3 h-3" />, label: 'Archived', color: 'text-slate-500 bg-slate-50 border-slate-200' },
}

function PlatformBadge({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'md' }) {
  const meta = PLATFORM_META[platform as keyof typeof PLATFORM_META]
  if (!meta) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${meta.badge} ${meta.borderColor} ${meta.textColor}`}>
      {size === 'md' && <span className={`w-2 h-2 rounded-full ${meta.bgColor}`} />}
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { icon: <Clock className="w-3 h-3" />, label: status, color: 'text-slate-500 bg-slate-50 border-slate-200' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  )
}

function fmt(n: number, type: 'currency' | 'number' | 'percent' | 'decimal' = 'number') {
  if (type === 'currency') return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (type === 'percent') return `${(n * 100).toFixed(2)}%`
  if (type === 'decimal') return n.toFixed(2)
  return n.toLocaleString('en-AU')
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon: Icon, color = 'text-indigo-600' }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ accountParam }: { accountParam?: string }) {
  const [summary, setSummary] = useState<PerfSummary | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesRow[]>([])
  const [platformBreakdown, setPlatformBreakdown] = useState<{ platform: string; spend: number; clicks: number; conversions: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const until = new Date().toISOString().split('T')[0]
    const qs = new URLSearchParams({ since, until, ...(accountParam ? { account: accountParam } : {}) })
    const res = await fetch(`/api/ads/performance?${qs}`)
    if (res.ok) {
      const data = await res.json()
      setSummary(data.summary)
      setTimeSeries(data.timeSeries ?? [])
    }

    // Get per-platform breakdown
    const platforms = ['google_ads', 'meta_ads']
    const breakdowns = await Promise.all(platforms.map(async p => {
      const r = await fetch(`/api/ads/performance?${new URLSearchParams({ since, until, platform: p, ...(accountParam ? { account: accountParam } : {}) })}`)
      if (!r.ok) return null
      const d = await r.json()
      return { platform: p, spend: d.summary.spend, clicks: d.summary.clicks, conversions: d.summary.conversions }
    }))
    setPlatformBreakdown(breakdowns.filter(Boolean) as typeof platformBreakdown)
    setLoading(false)
  }, [accountParam, days])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>

  if (!summary || summary.spend === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-20 text-slate-400">
        <Target className="w-12 h-12 mb-3 opacity-25" />
        <p className="font-semibold text-slate-500 text-lg">No ad performance data yet</p>
        <p className="text-sm mt-1 text-center max-w-xs">Connect an ad account and click Sync to pull your campaign metrics.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex items-center gap-2">
        {[7, 14, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${days === d ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {d}d
          </button>
        ))}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Spend" value={fmt(summary.spend, 'currency')} icon={DollarSign} color="text-red-500" />
        <MetricCard label="Impressions" value={fmt(summary.impressions)} icon={Eye} color="text-blue-500" />
        <MetricCard label="Clicks" value={fmt(summary.clicks)} sub={`${fmt(summary.ctr, 'percent')} CTR`} icon={MousePointer} color="text-indigo-500" />
        <MetricCard label="Conversions" value={fmt(summary.conversions, 'decimal')} sub={`$${fmt(summary.cpl, 'decimal')} CPL`} icon={Target} color="text-emerald-500" />
        <MetricCard label="ROAS" value={`${fmt(summary.roas, 'decimal')}x`} sub="Return on ad spend" icon={TrendingUp} color="text-amber-500" />
        <MetricCard label="Avg CPC" value={fmt(summary.cpc, 'currency')} sub={`$${fmt(summary.cpm, 'decimal')} CPM`} icon={DollarSign} color="text-purple-500" />
      </div>

      {/* Spend over time */}
      {timeSeries.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Spend & Conversions Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [n === 'spend' ? `$${Number(v).toFixed(2)}` : v, n === 'spend' ? 'Spend' : 'Conversions']} />
              <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={2} dot={false} name="spend" />
              <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} dot={false} name="conversions" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform breakdown */}
      {platformBreakdown.some(p => p.spend > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Platform Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={platformBreakdown.map(p => ({ ...p, name: PLATFORM_META[p.platform as keyof typeof PLATFORM_META]?.label ?? p.platform }))}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v, n) => [n === 'spend' ? `$${Number(v).toFixed(2)}` : v, n === 'spend' ? 'Spend' : n]} />
              <Legend />
              <Bar dataKey="spend" fill="#6366f1" name="Spend" radius={[4, 4, 0, 0]} />
              <Bar dataKey="clicks" fill="#10b981" name="Clicks" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CampaignsTab({ accountParam, adAccounts }: { accountParam?: string; adAccounts: AdPlatformAccount[] }) {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ ...(accountParam ? { account: accountParam } : {}) })
    const res = await fetch(`/api/ads/campaigns?${qs}`)
    if (res.ok) {
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
    }
    setLoading(false)
  }, [accountParam])

  useEffect(() => { load() }, [load])

  async function toggleStatus(campaign: AdCampaign) {
    setToggling(campaign.id)
    const newStatus = ['active', 'enabled'].includes(campaign.status) ? 'paused' : 'active'
    await fetch(`/api/ads/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c))
    setToggling(null)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Remove this campaign from the CRM? The campaign will remain on the platform.')) return
    setDeleting(id)
    await fetch(`/api/ads/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  const filtered = campaigns.filter(c => {
    if (platformFilter !== 'all' && c.platform !== platformFilter) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {['all', 'google_ads', 'meta_ads'].map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${platformFilter === p ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {p === 'all' ? 'All Platforms' : PLATFORM_META[p as keyof typeof PLATFORM_META]?.label ?? p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {['all', 'active', 'paused'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s ? 'bg-slate-800 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-16 text-slate-400">
          <Target className="w-10 h-10 mb-3 opacity-25" />
          <p className="font-medium text-slate-500">No campaigns found</p>
          <p className="text-sm mt-1">Sync your ad account or create a campaign in the Ad Builder tab</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Budget</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Start</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(campaign => (
                <tr key={campaign.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900 truncate max-w-[200px]">{campaign.name}</p>
                      {campaign.objective && <p className="text-xs text-slate-400 capitalize mt-0.5">{campaign.objective}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <PlatformBadge platform={campaign.platform} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {campaign.budgetAmount ? (
                      <span className="text-slate-700">{fmt(campaign.budgetAmount, 'currency')}<span className="text-slate-400 text-xs">/{campaign.budgetType === 'daily' ? 'd' : 'total'}</span></span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell text-slate-500 text-xs">
                    {campaign.startDate ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleStatus(campaign)}
                        disabled={toggling === campaign.id || campaign.status === 'removed'}
                        title={['active', 'enabled'].includes(campaign.status) ? 'Pause campaign' : 'Resume campaign'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                      >
                        {toggling === campaign.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : ['active', 'enabled'].includes(campaign.status) ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteCampaign(campaign.id)}
                        disabled={deleting === campaign.id}
                        title="Remove from CRM"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deleting === campaign.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Ad Builder Tab ───────────────────────────────────────────────────────────

type BuilderStep = 'platform' | 'objective' | 'budget' | 'creative' | 'review'

const OBJECTIVES = [
  { value: 'awareness', label: 'Brand Awareness', description: 'Reach the most people and build brand recognition', icon: '📢' },
  { value: 'traffic', label: 'Traffic', description: 'Drive clicks to your website or landing page', icon: '🖱️' },
  { value: 'leads', label: 'Lead Generation', description: 'Collect leads from people interested in your business', icon: '🎯' },
  { value: 'sales', label: 'Sales / Conversions', description: 'Drive purchases or conversions on your website', icon: '💰' },
]

const CTAS = ['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW', 'BOOK_NOW', 'DOWNLOAD']

function AdBuilderTab({ adAccounts, accountParam }: { adAccounts: AdPlatformAccount[]; accountParam?: string }) {
  const [step, setStep] = useState<BuilderStep>('platform')
  const [selectedAccount, setSelectedAccount] = useState<AdPlatformAccount | null>(null)
  const [objective, setObjective] = useState('')
  const [budgetType, setBudgetType] = useState<'daily' | 'lifetime'>('daily')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [headline, setHeadline] = useState('')
  const [primaryText, setPrimaryText] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [callToAction, setCallToAction] = useState('LEARN_MORE')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const steps: { id: BuilderStep; label: string }[] = [
    { id: 'platform', label: 'Platform' },
    { id: 'objective', label: 'Objective' },
    { id: 'budget', label: 'Budget' },
    { id: 'creative', label: 'Creative' },
    { id: 'review', label: 'Review' },
  ]

  const stepOrder: BuilderStep[] = ['platform', 'objective', 'budget', 'creative', 'review']
  const currentIndex = stepOrder.indexOf(step)

  function nextStep() {
    if (currentIndex < stepOrder.length - 1) setStep(stepOrder[currentIndex + 1])
  }
  function prevStep() {
    if (currentIndex > 0) setStep(stepOrder[currentIndex - 1])
  }

  async function submit() {
    if (!selectedAccount || !objective || !budgetAmount || !campaignName) {
      setError('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const qs = accountParam ? `?account=${accountParam}` : ''
      const res = await fetch(`/api/ads/campaigns${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adPlatformAccountId: selectedAccount.id,
          name: campaignName,
          objective,
          budgetType,
          budgetAmount: Number(budgetAmount),
          startDate,
          endDate: endDate || undefined,
          headline: headline || undefined,
          primaryText: primaryText || undefined,
          destinationUrl: destinationUrl || undefined,
          callToAction: callToAction || undefined,
          imageUrl: imageUrl || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create campaign'); return }
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setStep('platform'); setSelectedAccount(null); setObjective(''); setBudgetAmount('')
    setCampaignName(''); setHeadline(''); setPrimaryText(''); setDestinationUrl('')
    setCallToAction('LEARN_MORE'); setImageUrl(''); setSuccess(false); setError(null)
  }

  const activeAccounts = adAccounts.filter(a => a.enabled && a.platform !== 'tiktok_ads')

  if (success) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Campaign Created!</h3>
        <p className="text-slate-500 text-center max-w-sm">
          Your campaign <strong>{campaignName}</strong> has been created on {PLATFORM_META[selectedAccount!.platform as keyof typeof PLATFORM_META]?.label} and is currently paused. Enable it from the Campaigns tab when ready.
        </p>
        <button onClick={reset} className="mt-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          Create Another Campaign
        </button>
      </div>
    )
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-16 text-slate-400">
        <Target className="w-10 h-10 mb-3 opacity-25" />
        <p className="font-medium text-slate-500">No connected ad accounts</p>
        <p className="text-sm mt-1">Connect a Google Ads or Meta Ads account in the Accounts tab first</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Step progress */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 flex-1">
            <div className="flex items-center gap-1.5 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step === s.id ? 'bg-indigo-600 text-white' : i < currentIndex ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {i < currentIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === s.id ? 'text-indigo-600' : i < currentIndex ? 'text-emerald-600' : 'text-slate-400'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-px flex-1 mx-1 ${i < currentIndex ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Step: Platform */}
        {step === 'platform' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Choose Ad Platform</h2>
            <p className="text-sm text-slate-400 mb-5">Select which ad account to create this campaign in</p>
            <div className="space-y-3">
              {activeAccounts.map(acct => {
                const meta = PLATFORM_META[acct.platform as keyof typeof PLATFORM_META]
                const isSelected = selectedAccount?.id === acct.id
                return (
                  <button
                    key={acct.id}
                    onClick={() => setSelectedAccount(acct)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <div className={`w-10 h-10 ${meta?.bgColor ?? 'bg-slate-300'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{meta?.label ?? acct.platform}</p>
                      <p className="text-sm text-slate-500 truncate">{acct.platformAccountName}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step: Objective */}
        {step === 'objective' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Campaign Objective</h2>
            <p className="text-sm text-slate-400 mb-5">What do you want to achieve with this campaign?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OBJECTIVES.map(obj => (
                <button
                  key={obj.value}
                  onClick={() => setObjective(obj.value)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${objective === obj.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <span className="text-2xl flex-shrink-0">{obj.icon}</span>
                  <div>
                    <p className={`font-semibold text-sm ${objective === obj.value ? 'text-indigo-900' : 'text-slate-900'}`}>{obj.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{obj.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Budget */}
        {step === 'budget' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Budget & Schedule</h2>
            <p className="text-sm text-slate-400 mb-5">Set your campaign budget and run dates</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Campaign Name *</label>
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Summer Sale 2025 — Google Search"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Budget Type</label>
                <div className="flex gap-2">
                  {(['daily', 'lifetime'] as const).map(t => (
                    <button key={t} onClick={() => setBudgetType(t)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${budgetType === t ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {t === 'daily' ? 'Daily Budget' : 'Lifetime Budget'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                  {budgetType === 'daily' ? 'Daily Budget (AUD) *' : 'Total Budget (AUD) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                  <input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="50.00" min="1" step="0.01"
                    className="w-full pl-7 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {budgetType === 'daily' && budgetAmount && (
                  <p className="text-xs text-slate-400 mt-1">≈ {fmt(Number(budgetAmount) * 30, 'currency')} / month</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Start Date *</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <p className="text-xs text-slate-400 mt-1">Leave blank to run indefinitely</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Creative */}
        {step === 'creative' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Ad Creative</h2>
            <p className="text-sm text-slate-400 mb-5">
              Write your ad copy. {selectedAccount?.platform === 'meta_ads' ? 'A basic ad set and ad will be created automatically if a destination URL is provided.' : 'Ad groups and ads can be added after campaign creation.'}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  Headline
                  <span className="font-normal text-slate-400">{selectedAccount?.platform === 'google_ads' ? '(max 30 chars)' : '(max 255 chars)'}</span>
                </label>
                <input value={headline} onChange={e => setHeadline(e.target.value)}
                  maxLength={selectedAccount?.platform === 'google_ads' ? 30 : 255}
                  placeholder="Trusted Electricians in Sydney — Free Quote"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400 text-right mt-1">{headline.length} / {selectedAccount?.platform === 'google_ads' ? 30 : 255}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  Primary Text / Description
                  <span className="font-normal text-slate-400">{selectedAccount?.platform === 'google_ads' ? '(max 90 chars)' : '(max 125 chars)'}</span>
                </label>
                <textarea value={primaryText} onChange={e => setPrimaryText(e.target.value)} rows={3}
                  maxLength={selectedAccount?.platform === 'google_ads' ? 90 : 125}
                  placeholder="Licensed electricians serving all Sydney suburbs. Call us today for a free, no-obligation quote."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400 text-right mt-1">{primaryText.length} / {selectedAccount?.platform === 'google_ads' ? 90 : 125}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Destination URL</label>
                <input type="url" value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)} placeholder="https://yourwebsite.com.au/landing"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {selectedAccount?.platform === 'meta_ads' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Call to Action</label>
                    <select value={callToAction} onChange={e => setCallToAction(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {CTAS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Image URL <span className="font-normal text-slate-400">(optional)</span></label>
                    <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://yourwebsite.com.au/ad-image.jpg"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  {imageUrl && <img src={imageUrl} alt="Preview" className="rounded-lg border border-slate-200 max-h-48 w-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Review & Launch</h2>
            <p className="text-sm text-slate-400 mb-5">Review your campaign settings before creating it on the platform</p>
            <div className="space-y-3">
              {[
                { label: 'Platform', value: PLATFORM_META[selectedAccount?.platform as keyof typeof PLATFORM_META]?.label ?? '' },
                { label: 'Ad Account', value: selectedAccount?.platformAccountName ?? '' },
                { label: 'Campaign Name', value: campaignName },
                { label: 'Objective', value: OBJECTIVES.find(o => o.value === objective)?.label ?? objective },
                { label: 'Budget', value: `${fmt(Number(budgetAmount), 'currency')} / ${budgetType}` },
                { label: 'Start Date', value: startDate },
                { label: 'End Date', value: endDate || 'No end date' },
                ...(headline ? [{ label: 'Headline', value: headline }] : []),
                ...(primaryText ? [{ label: 'Ad Text', value: primaryText }] : []),
                ...(destinationUrl ? [{ label: 'Destination URL', value: destinationUrl }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
                  <span className="text-sm font-medium text-slate-500 flex-shrink-0 w-32">{label}</span>
                  <span className="text-sm text-slate-900 text-right break-all">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">The campaign will be created in <strong>paused</strong> status. Review it on the platform, then enable it when you&apos;re ready to go live.</p>
            </div>
            {error && <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button onClick={prevStep} disabled={currentIndex === 0}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-0 transition-colors">
            ← Back
          </button>
          {step === 'review' ? (
            <button onClick={submit} disabled={submitting || !campaignName || !budgetAmount}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              Create Campaign
            </button>
          ) : (
            <button onClick={nextStep}
              disabled={
                (step === 'platform' && !selectedAccount) ||
                (step === 'objective' && !objective) ||
                (step === 'budget' && (!budgetAmount || !campaignName))
              }
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Attribution Tab ──────────────────────────────────────────────────────────

function AttributionTab({ accountParam }: { accountParam?: string }) {
  const [leads, setLeads] = useState<AttributionLead[]>([])
  const [summary, setSummary] = useState<{ totalAttributed: number; googleLeads: number; metaLeads: number; googleConversionValue: number; metaConversionValue: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ ...(accountParam ? { account: accountParam } : {}), ...(platformFilter !== 'all' ? { platform: platformFilter } : {}) })
    const res = await fetch(`/api/ads/attribution?${qs}`)
    if (res.ok) {
      const data = await res.json()
      setLeads(data.leads ?? [])
      setSummary(data.summary ?? null)
    }
    setLoading(false)
  }, [accountParam, platformFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Attributed" value={String(summary.totalAttributed)} icon={Users} color="text-indigo-500" />
          <MetricCard label="Google Leads" value={String(summary.googleLeads)} sub={`$${fmt(summary.googleConversionValue, 'decimal')} value`} icon={Target} color="text-blue-500" />
          <MetricCard label="Meta Leads" value={String(summary.metaLeads)} sub={`$${fmt(summary.metaConversionValue, 'decimal')} value`} icon={Target} color="text-indigo-500" />
          <MetricCard label="Total Value" value={fmt(summary.googleConversionValue + summary.metaConversionValue, 'currency')} icon={DollarSign} color="text-emerald-500" />
        </div>
      )}

      <div className="flex items-center gap-2">
        {['all', 'google_ads', 'meta_ads'].map(p => (
          <button key={p} onClick={() => setPlatformFilter(p)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${platformFilter === p ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {p === 'all' ? 'All Platforms' : PLATFORM_META[p as keyof typeof PLATFORM_META]?.label ?? p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-16 text-slate-400">
          <Users className="w-10 h-10 mb-3 opacity-25" />
          <p className="font-medium text-slate-500">No attributed leads yet</p>
          <p className="text-sm mt-1 text-center max-w-xs">Leads with a gclid or fbclid will appear here once they come in via your webhook</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Value</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.map(lead => (
                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    {lead.email && <p className="text-xs text-slate-400">{lead.email}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {lead.platform && <PlatformBadge platform={lead.platform} />}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-slate-600 text-xs">{lead.campaignName ?? lead.utmCampaign ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-md border capitalize text-slate-600 border-slate-200">{lead.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {lead.value ? <span className="font-medium text-slate-700">{fmt(lead.value, 'currency')}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-slate-400">
                    {new Date(lead.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Audiences Tab ────────────────────────────────────────────────────────────

const AUDIENCE_STATUS_META = {
  pending: { color: 'text-slate-500 bg-slate-50 border-slate-200', label: 'Pending', icon: <Clock className="w-3 h-3" /> },
  uploading: { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Uploading…', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  ready: { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Ready', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { color: 'text-red-600 bg-red-50 border-red-200', label: 'Failed', icon: <XCircle className="w-3 h-3" /> },
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost']

function AudiencesTab({ adAccounts, accountParam }: { adAccounts: AdPlatformAccount[]; accountParam?: string }) {
  const [audiences, setAudiences] = useState<AdAudience[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPlatformAccountId, setNewPlatformAccountId] = useState('')
  const [newStatuses, setNewStatuses] = useState<string[]>(['won'])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/ads/audiences${qs}`)
    if (res.ok) {
      const data = await res.json()
      setAudiences(data.audiences ?? [])
    }
    setLoading(false)
  }, [accountParam])

  useEffect(() => { load() }, [load])

  async function uploadAudience(id: string) {
    setUploading(id)
    await fetch(`/api/ads/audiences/${id}/upload`, { method: 'POST' })
    await load()
    setUploading(null)
  }

  async function deleteAudience(id: string) {
    if (!confirm('Delete this audience?')) return
    setDeleting(id)
    await fetch(`/api/ads/audiences/${id}`, { method: 'DELETE' })
    setAudiences(prev => prev.filter(a => a.id !== id))
    setDeleting(null)
  }

  async function createAudience() {
    if (!newName.trim() || !newPlatformAccountId) { setCreateError('Name and ad account are required'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const qs = accountParam ? `?account=${accountParam}` : ''
      const res = await fetch(`/api/ads/audiences${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adPlatformAccountId: newPlatformAccountId,
          name: newName,
          description: newDescription || undefined,
          segmentFilter: { statuses: newStatuses },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Failed'); return }
      setAudiences(prev => [data.audience, ...prev])
      setShowCreate(false); setNewName(''); setNewDescription(''); setNewPlatformAccountId(''); setNewStatuses(['won'])
    } catch (e) { setCreateError(String(e)) }
    finally { setCreating(false) }
  }

  const activeAccounts = adAccounts.filter(a => a.enabled && a.platform !== 'tiktok_ads')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Custom Audiences</h3>
          <p className="text-xs text-slate-400 mt-0.5">Build audiences from your CRM leads and sync them to your ad platforms</p>
        </div>
        {activeAccounts.length > 0 && (
          <button onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> New Audience
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="font-semibold text-slate-900 text-sm">Create Audience</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Audience Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Existing Customers"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Ad Account *</label>
              <select value={newPlatformAccountId} onChange={e => setNewPlatformAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select account…</option>
                {activeAccounts.map(a => <option key={a.id} value={a.id}>{PLATFORM_META[a.platform as keyof typeof PLATFORM_META]?.label} — {a.platformAccountName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Description</label>
              <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Optional description"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Lead Statuses to Include</label>
              <div className="flex flex-wrap gap-2">
                {LEAD_STATUSES.map(s => (
                  <button key={s} onClick={() => setNewStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className={`text-xs px-2.5 py-1 rounded-full border capitalize transition-colors ${newStatuses.includes(s) ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {createError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>}
          <div className="flex items-center gap-2">
            <button onClick={createAudience} disabled={creating}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create
            </button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : audiences.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-16 text-slate-400">
          <Users className="w-10 h-10 mb-3 opacity-25" />
          <p className="font-medium text-slate-500">No audiences created yet</p>
          <p className="text-sm mt-1">Create an audience from your CRM lead segments above</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
          {audiences.map(audience => {
            const statusMeta = AUDIENCE_STATUS_META[audience.status as keyof typeof AUDIENCE_STATUS_META] ?? AUDIENCE_STATUS_META.pending
            return (
              <div key={audience.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">{audience.name}</p>
                    <PlatformBadge platform={audience.platform} />
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${statusMeta.color}`}>
                      {statusMeta.icon}{statusMeta.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {audience.adPlatformAccount.platformAccountName}
                    {audience.memberCount > 0 && ` · ${audience.memberCount.toLocaleString()} members`}
                    {audience.uploadedAt && ` · Last synced ${new Date(audience.uploadedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                  </p>
                  {audience.description && <p className="text-xs text-slate-400 mt-0.5">{audience.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => uploadAudience(audience.id)} disabled={uploading === audience.id || audience.status === 'uploading'}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
                    {uploading === audience.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {audience.status === 'ready' ? 'Re-sync' : 'Upload'}
                  </button>
                  <button onClick={() => deleteAudience(audience.id)} disabled={deleting === audience.id}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                    {deleting === audience.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

// ─── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab({ adAccounts, pendingGoogleOAuth, accountParam, onConnect, onDisconnect }: {
  adAccounts: AdPlatformAccount[]
  pendingGoogleOAuth: { refreshToken: string; email?: string } | null
  accountParam?: string
  onConnect: () => void
  onDisconnect: (id: string) => void
}) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [developerToken, setDeveloperToken] = useState('')
  const [loginCustomerId, setLoginCustomerId] = useState('')
  const [configuringGoogle, setConfiguringGoogle] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [showDevTokenHelp, setShowDevTokenHelp] = useState(false)

  async function disconnect(id: string) {
    if (!confirm('Disconnect this ad account? Campaigns and performance data will be removed.')) return
    setDisconnecting(id)
    await fetch(`/api/ads/accounts/${id}`, { method: 'DELETE' })
    onDisconnect(id)
    setDisconnecting(null)
  }

  async function syncNow(id: string) {
    setSyncing(id)
    await fetch('/api/ads/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adPlatformAccountId: id }),
    })
    setSyncing(null)
    onConnect()
  }

  async function finalizeGoogleOAuth() {
    if (!customerId.trim()) { setConfigError('Customer ID is required'); return }
    const dt = developerToken.trim() || process.env.NEXT_PUBLIC_GOOGLE_ADS_DEV_TOKEN || ''
    setConfiguringGoogle(true)
    setConfigError(null)
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/ads/accounts${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'google_ads', customerId, developerToken: dt, loginCustomerId: loginCustomerId.trim().replace(/-/g, '') || undefined }),
    })
    const data = await res.json()
    if (!res.ok) {
      const diagLines: string[] = data.diagnostics ?? []
      const diagText = diagLines.length ? `\n\nDiagnostics:\n${diagLines.join('\n')}` : ''
      setConfigError((data.error ?? 'Failed') + diagText)
      setConfiguringGoogle(false)
      return
    }
    setConfiguringGoogle(false)
    onConnect()
  }

  function connectUrl(platform: string) {
    const qs = new URLSearchParams({ platform, ...(accountParam ? { account: accountParam } : {}) })
    return `/api/ads/connect?${qs}`
  }

  const PLATFORMS = [
    { platform: 'google_ads', label: 'Google Ads', description: 'Search, Display, Shopping, and YouTube campaigns', bgColor: 'bg-blue-500' },
    { platform: 'meta_ads', label: 'Meta Ads', description: 'Facebook and Instagram ad campaigns', bgColor: 'bg-indigo-600' },
    { platform: 'tiktok_ads', label: 'TikTok Ads', description: 'Short-form video ad campaigns', bgColor: 'bg-slate-800', comingSoon: true },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Pending Google OAuth configure step */}
      {pendingGoogleOAuth && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">Google Ads: Final Configuration Required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                OAuth connected for {pendingGoogleOAuth.email ?? 'your Google account'}. Enter your Google Ads Customer ID to complete the connection.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Customer ID *</label>
              <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="123-456-7890"
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" />
              <p className="text-xs text-amber-700 mt-1">Found in your Google Ads account under the account name</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Developer Token</label>
                <button onClick={() => setShowDevTokenHelp(v => !v)} className="text-xs text-amber-700 hover:text-amber-900 underline">
                  What is this?
                </button>
              </div>
              <input value={developerToken} onChange={e => setDeveloperToken(e.target.value)} placeholder="Leave blank if set in GOOGLE_ADS_DEVELOPER_TOKEN env var"
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" />
              {showDevTokenHelp && (
                <p className="text-xs text-amber-700 mt-1.5 bg-amber-100 rounded-lg p-2">
                  Required for Google Ads API. Get it in your Google Ads account under Tools → API Center. If you set <code>GOOGLE_ADS_DEVELOPER_TOKEN</code> as an environment variable, you can leave this blank.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Manager Account ID (MCC)</label>
              <input value={loginCustomerId} onChange={e => setLoginCustomerId(e.target.value)} placeholder="611-079-8576"
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" />
              <p className="text-xs text-amber-700 mt-1">Required if your account is managed under a Google Ads Manager (MCC) account. Leave blank if you access Google Ads directly.</p>
            </div>
            {configError && <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap break-all">{configError}</pre>}
            <button onClick={finalizeGoogleOAuth} disabled={configuringGoogle}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {configuringGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Verify & Connect
            </button>
          </div>
        </div>
      )}

      {/* Platform list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Ad Platform Accounts</h3>
          <p className="text-xs text-slate-400 mt-0.5">Connect your advertising accounts to manage campaigns and pull performance data</p>
        </div>
        <div className="divide-y divide-slate-50">
          {PLATFORMS.map(({ platform, label, description, bgColor, comingSoon }) => {
            const connected = adAccounts.filter(a => a.platform === platform)
            return (
              <div key={platform} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="text-xs text-slate-400">{description}</p>
                    </div>
                  </div>
                  {comingSoon ? (
                    <span className="text-xs text-slate-400 border border-slate-200 rounded-full px-3 py-1 flex-shrink-0">Coming soon</span>
                  ) : (
                    <a href={connectUrl(platform)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0 flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      {connected.length > 0 ? 'Reconnect' : 'Connect'}
                    </a>
                  )}
                </div>
                {connected.length > 0 && (
                  <div className="mt-3 space-y-2 pl-13">
                    {connected.map(acct => (
                      <div key={acct.id} className="ml-13 flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{acct.platformAccountName}</p>
                            <p className="text-xs text-slate-400">
                              ID: {acct.platformAccountId} · {acct.currencyCode}
                              {acct.syncedAt && ` · Synced ${new Date(acct.syncedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => syncNow(acct.id)} disabled={syncing === acct.id}
                            title="Sync now"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50">
                            {syncing === acct.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => disconnect(acct.id)} disabled={disconnecting === acct.id}
                            title="Disconnect"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                            {disconnecting === acct.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Setup guide */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h4 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-500" /> Setup Guide
        </h4>
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-400 flex-shrink-0 w-4">1.</span>
            <p><strong>Google Ads:</strong> Set <code className="bg-white border border-slate-200 rounded px-1 py-0.5">GOOGLE_ADS_CLIENT_ID</code>, <code className="bg-white border border-slate-200 rounded px-1 py-0.5">GOOGLE_ADS_CLIENT_SECRET</code>, and <code className="bg-white border border-slate-200 rounded px-1 py-0.5">GOOGLE_ADS_DEVELOPER_TOKEN</code> in your environment variables. Register <code>/api/ads/callback/google_ads</code> as an OAuth redirect URI.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-400 flex-shrink-0 w-4">2.</span>
            <p><strong>Meta Ads:</strong> Uses the same <code className="bg-white border border-slate-200 rounded px-1 py-0.5">FACEBOOK_APP_ID</code> and <code className="bg-white border border-slate-200 rounded px-1 py-0.5">FACEBOOK_APP_SECRET</code> as Social. Register <code>/api/ads/callback/meta_ads</code> as a valid OAuth redirect URI in your Facebook App settings. Ensure your app has <strong>Marketing API</strong> enabled.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-400 flex-shrink-0 w-4">3.</span>
            <p>After connecting, click <strong>Sync</strong> on each account to pull your campaigns and 30 days of performance data.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'campaigns' | 'builder' | 'attribution' | 'audiences' | 'accounts'

export default function AdsPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined
  const adsStatus = sp.get('ads_status')
  const connectedPlatform = sp.get('platform')
  const requiresConfig = sp.get('step') === 'configure'
  const errorMsg = sp.get('msg')

  const [tab, setTab] = useState<Tab>(requiresConfig || adsStatus === 'connected' ? 'accounts' : 'overview')
  const [adAccounts, setAdAccounts] = useState<AdPlatformAccount[]>([])
  const [pendingGoogleOAuth, setPendingGoogleOAuth] = useState<{ refreshToken: string; email?: string } | null>(null)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/ads/accounts${qs}`)
    if (res.ok) {
      const data = await res.json()
      setAdAccounts(data.accounts ?? [])
      setPendingGoogleOAuth(data.pendingGoogleOAuth ?? null)
    }
    setLoadingAccounts(false)
  }, [accountParam])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  async function syncAll() {
    setSyncing(true)
    const qs = accountParam ? `?account=${accountParam}` : ''
    await fetch(`/api/ads/sync${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    await fetchAccounts()
    setSyncing(false)
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'builder', label: 'Ad Builder' },
    { id: 'attribution', label: 'Attribution' },
    { id: 'audiences', label: 'Audiences' },
    { id: 'accounts', label: 'Accounts', count: adAccounts.length || undefined },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-white" />
            </div>
            Ad Manager
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Manage Google Ads and Meta Ads campaigns from one place</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {adAccounts.length > 0 && (
            <button onClick={syncAll} disabled={syncing}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync All
            </button>
          )}
        </div>
      </div>

      {/* Connected accounts strip */}
      {!loadingAccounts && adAccounts.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">Connected:</span>
          {adAccounts.map(a => (
            <div key={a.id} className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1">
              <div className={`w-2 h-2 rounded-full ${PLATFORM_META[a.platform as keyof typeof PLATFORM_META]?.bgColor ?? 'bg-slate-400'}`} />
              <span className="text-xs text-slate-700 font-medium">{a.platformAccountName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status banners */}
      {adsStatus === 'connected' && !requiresConfig && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm text-emerald-800 font-medium">
          {PLATFORM_META[connectedPlatform as keyof typeof PLATFORM_META]?.label ?? connectedPlatform} connected successfully.
          {connectedPlatform === 'meta_ads' && ' Your active Meta ad accounts have been discovered. Click Sync to pull campaign data.'}
        </div>
      )}
      {adsStatus === 'connected' && requiresConfig && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 font-medium">
          Google OAuth connected. Enter your Customer ID below to complete the setup.
        </div>
      )}
      {adsStatus === 'error' && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800">
          <p className="font-medium">Connection failed{connectedPlatform ? ` for ${PLATFORM_META[connectedPlatform as keyof typeof PLATFORM_META]?.label ?? connectedPlatform}` : ''}.</p>
          {errorMsg && <p className="mt-0.5 text-red-700 text-xs font-mono">{decodeURIComponent(errorMsg)}</p>}
        </div>
      )}

      {/* No accounts empty state */}
      {!loadingAccounts && adAccounts.length === 0 && !pendingGoogleOAuth && tab !== 'accounts' && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-900">No ad accounts connected yet</p>
              <p className="text-xs text-indigo-700 mt-0.5">Connect Google Ads or Meta Ads to start managing campaigns</p>
            </div>
          </div>
          <button onClick={() => setTab('accounts')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 flex-shrink-0">
            Connect <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 mb-6 border-b border-slate-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
            {t.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tab === t.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab accountParam={accountParam} />}
      {tab === 'campaigns' && <CampaignsTab accountParam={accountParam} adAccounts={adAccounts} />}
      {tab === 'builder' && <AdBuilderTab adAccounts={adAccounts} accountParam={accountParam} />}
      {tab === 'attribution' && <AttributionTab accountParam={accountParam} />}
      {tab === 'audiences' && <AudiencesTab adAccounts={adAccounts} accountParam={accountParam} />}
      {tab === 'accounts' && (
        loadingAccounts ? (
          <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : (
          <AccountsTab
            adAccounts={adAccounts}
            pendingGoogleOAuth={pendingGoogleOAuth}
            accountParam={accountParam}
            onConnect={fetchAccounts}
            onDisconnect={id => setAdAccounts(prev => prev.filter(a => a.id !== id))}
          />
        )
      )}
    </div>
  )
}
