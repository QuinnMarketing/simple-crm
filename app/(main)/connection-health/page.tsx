'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Info, PlugZap } from 'lucide-react'

type Status = 'healthy' | 'needs_reconnect' | 'error' | 'no_token' | 'not_configured' | 'info'
type Integration = { platform: string; enabled: boolean; status: Status; detail: string; email?: string }
type AccountHealth = { accountId: string; accountName: string; integrations: Integration[] }
type Report = {
  checkedAt: string
  summary: { healthy: number; needs_reconnect: number; error: number; not_configured: number; other: number }
  accounts: AccountHealth[]
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google (account)',
  google_analytics: 'Google Analytics',
  google_ga4: 'GA4 Measurement',
  google_business: 'Google Business',
  google_calendar: 'Google Calendar',
  google_search_console: 'Search Console',
  google_ads: 'Google Ads',
  gmail: 'Gmail',
  sheets: 'Google Sheets',
  outlook: 'Outlook',
  facebook: 'Meta / Facebook',
  meta: 'Meta',
  linkedin: 'LinkedIn',
  servicem8: 'ServiceM8',
  email_smtp: 'SMTP Email',
}
const label = (p: string) => PLATFORM_LABELS[p] ?? p

// Deep-link straight into the correct OAuth flow for a broken connection.
function reconnectHref(platform: string, accountId: string): string | null {
  const a = `account=${accountId}`
  switch (platform) {
    case 'google':
    case 'google_analytics': return `/api/integrations/google/connect?${a}`
    case 'google_calendar':  return `/api/calendar/connect?${a}`
    case 'google_business':  return `/api/social/connect/google_business?${a}`
    case 'google_ads':       return `/api/ads/connect?platform=google_ads&${a}`
    case 'gmail':            return `/api/integrations/gmail/connect?${a}`
    case 'sheets':           return `/api/integrations/sheets/connect?${a}`
    case 'outlook':          return `/api/integrations/outlook/connect?${a}`
    default: return null
  }
}

const STATUS_STYLE: Record<Status, { cls: string; icon: React.ElementType; text: string }> = {
  healthy:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2,  text: 'Healthy' },
  needs_reconnect:{ cls: 'bg-red-50 text-red-700 border-red-200',             icon: AlertTriangle, text: 'Reconnect' },
  error:          { cls: 'bg-amber-50 text-amber-700 border-amber-200',       icon: XCircle,       text: 'Error' },
  not_configured: { cls: 'bg-slate-100 text-slate-600 border-slate-200',      icon: MinusCircle,   text: 'Not configured' },
  no_token:       { cls: 'bg-slate-100 text-slate-500 border-slate-200',      icon: MinusCircle,   text: 'No token' },
  info:           { cls: 'bg-slate-50 text-slate-500 border-slate-200',       icon: Info,          text: 'Info' },
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status]
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
      <Icon className="w-3 h-3" /> {s.text}
    </span>
  )
}

export default function ConnectionHealthPage() {
  const { data: session, status: authStatus } = useSession()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/master/connection-health')
      if (!r.ok) { setError(r.status === 403 ? 'Master admin only.' : 'Failed to run checks.'); return }
      setReport(await r.json())
    } catch {
      setError('Failed to run checks.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (authStatus === 'authenticated' && session?.user?.role !== 'master_admin') {
    return <p className="text-slate-500">This page is for master admins only.</p>
  }

  const problems = report?.accounts
    .map((a) => ({ ...a, integrations: a.integrations.filter((i) => i.status === 'needs_reconnect' || i.status === 'error') }))
    .filter((a) => a.integrations.length > 0) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PlugZap className="w-6 h-6 text-indigo-600" /> Connection Health
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Live-tests every stored OAuth token across all accounts. Tokens issued by a replaced OAuth client show as <span className="font-medium text-red-600">Reconnect</span>.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Re-run checks
        </button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</div>}

      {loading && !report && (
        <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Testing every connection live…
        </div>
      )}

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {([
              ['Healthy', report.summary.healthy, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
              ['Need reconnect', report.summary.needs_reconnect, 'text-red-700 bg-red-50 border-red-200'],
              ['Errors', report.summary.error, 'text-amber-700 bg-amber-50 border-amber-200'],
              ['Not configured', report.summary.not_configured, 'text-slate-600 bg-slate-50 border-slate-200'],
            ] as const).map(([lbl, n, cls]) => (
              <div key={lbl} className={`rounded-xl border p-4 ${cls}`}>
                <div className="text-2xl font-bold">{n}</div>
                <div className="text-xs font-medium mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>

          {/* Action list — what needs reconnecting */}
          {problems.length > 0 && (
            <div className="mb-8 rounded-xl border border-red-200 bg-red-50/50 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-red-800 text-sm">Action needed — reconnect these ({problems.reduce((s, a) => s + a.integrations.length, 0)})</span>
              </div>
              <div className="divide-y divide-red-100">
                {problems.map((a) => (
                  <div key={a.accountId} className="px-4 py-3">
                    <div className="font-medium text-slate-900 text-sm mb-1.5">{a.accountName}</div>
                    <div className="flex flex-wrap gap-2">
                      {a.integrations.map((i) => {
                        const href = reconnectHref(i.platform, a.accountId)
                        return (
                          <span key={i.platform} className="inline-flex items-center gap-1.5 text-xs bg-white border border-red-200 rounded-lg px-2 py-1">
                            <StatusBadge status={i.status} /> <span className="text-slate-700">{label(i.platform)}</span>
                            {href && (
                              <a href={href} className="ml-1 inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                                <RefreshCw className="w-3 h-3" /> Reconnect
                              </a>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 text-xs text-red-700 bg-red-50 border-t border-red-100">
                Click <strong>Reconnect</strong> on each, then sign in as that client&apos;s Google account and approve. For Analytics you&apos;ll also pick the GA4 property. Re-run the check afterwards to confirm green.
              </div>
            </div>
          )}

          {/* Full matrix */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-slate-800 text-sm">All connections ({report.accounts.length} accounts)</span>
              <span className="text-xs text-slate-400">Checked {new Date(report.checkedAt).toLocaleString('en-AU')}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {report.accounts.map((a) => (
                <div key={a.accountId} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="sm:w-56 font-medium text-slate-800 text-sm shrink-0">{a.accountName}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.integrations.map((i) => (
                      <span
                        key={i.platform}
                        title={i.detail + (i.email ? ` · ${i.email}` : '')}
                        className="inline-flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
                      >
                        <span className="text-slate-600">{label(i.platform)}</span>
                        <StatusBadge status={i.status} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
