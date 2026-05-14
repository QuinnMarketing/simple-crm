'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Save, CalendarDays, Mail, TrendingUp } from 'lucide-react'
import Link from 'next/link'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface IntegrationsFormProps {
  accountId: string
  initialConfigs: Record<string, Record<string, string>>
}

function isConfigured(config: Record<string, string> | undefined, keys: string[]) {
  return !!config && keys.every((k) => !!config[k]?.trim())
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
      ok ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
    }`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
      {ok ? `${label} connected` : `${label} not connected`}
    </span>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{children}</p>
}

export default function IntegrationsForm({ accountId, initialConfigs }: IntegrationsFormProps) {
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  const [smtp, setSmtp] = useState({
    host: initialConfigs.email_smtp?.host ?? '',
    port: initialConfigs.email_smtp?.port ?? '587',
    user: initialConfigs.email_smtp?.user ?? '',
    pass: initialConfigs.email_smtp?.pass ?? '',
    from: initialConfigs.email_smtp?.from ?? '',
  })

  const [ga4, setGa4] = useState({
    measurementId: initialConfigs.google_ga4?.measurementId ?? '',
    apiSecret: initialConfigs.google_ga4?.apiSecret ?? '',
  })

  const [gaReport, setGaReport] = useState({
    propertyId: initialConfigs.google_analytics?.propertyId ?? '',
    refreshToken: initialConfigs.google_analytics?.refreshToken ?? '',
    email: initialConfigs.google_analytics?.email ?? '',
  })

  const [ads, setAds] = useState({
    developerToken: initialConfigs.google_ads?.developerToken ?? '',
    customerId: initialConfigs.google_ads?.customerId ?? '',
    clientId: initialConfigs.google_ads?.clientId ?? '',
    clientSecret: initialConfigs.google_ads?.clientSecret ?? '',
    refreshToken: initialConfigs.google_ads?.refreshToken ?? '',
    conversionActionId: initialConfigs.google_ads?.conversionActionId ?? '',
    qualifiedConversionActionId: initialConfigs.google_ads?.qualifiedConversionActionId ?? '',
    wonConversionActionId: initialConfigs.google_ads?.wonConversionActionId ?? '',
  })

  const [fb, setFb] = useState({
    pixelId: initialConfigs.facebook?.pixelId ?? '',
    accessToken: initialConfigs.facebook?.accessToken ?? '',
    adAccountId: initialConfigs.facebook?.adAccountId ?? '',
  })

  const [saveState, setSaveState] = useState<Record<string, SaveState>>({
    email_smtp: 'idle',
    google_ga4: 'idle',
    google_analytics: 'idle',
    google_ads: 'idle',
    facebook: 'idle',
  })

  async function saveIntegration(platform: string, config: Record<string, string>) {
    setSaveState((s) => ({ ...s, [platform]: 'saving' }))
    try {
      const res = await fetch(`/api/accounts/${accountId}/integrations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, config, enabled: true }),
      })
      setSaveState((s) => ({ ...s, [platform]: res.ok ? 'saved' : 'error' }))
      setTimeout(() => setSaveState((s) => ({ ...s, [platform]: 'idle' })), 2500)
    } catch {
      setSaveState((s) => ({ ...s, [platform]: 'error' }))
    }
  }

  async function disconnect(platform: string) {
    await fetch(`/api/accounts/${accountId}/integrations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, config: {}, enabled: false }),
    })
    window.location.reload()
  }

  function SaveBtn({ platform, config }: { platform: string; config: Record<string, string> }) {
    const s = saveState[platform]
    return (
      <button
        onClick={() => saveIntegration(platform, config)}
        disabled={s === 'saving'}
        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {s === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          : s === 'saved'  ? <><CheckCircle className="w-4 h-4" /> Saved!</>
          : s === 'error'  ? <><XCircle className="w-4 h-4" /> Error — Retry</>
          : <><Save className="w-4 h-4" /> Save</>}
      </button>
    )
  }

  const smtpOk       = isConfigured(smtp, ['host', 'user', 'pass'])
  const ga4Ok        = isConfigured(ga4, ['measurementId', 'apiSecret'])
  const gaReportOk   = !!initialConfigs.google_analytics?.refreshToken
  const gaReportEmail = initialConfigs.google_analytics?.email
  const adsOk        = isConfigured(ads, ['developerToken', 'customerId', 'clientId', 'clientSecret', 'refreshToken'])
  const fbOk         = isConfigured(fb, ['pixelId', 'accessToken'])
  const gcalConnected = !!initialConfigs.google_calendar?.refreshToken
  const gcalEmail    = initialConfigs.google_calendar?.email

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-slate-900 text-lg">Integrations</h2>

      {/* ── Email ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" /> Email (SMTP)
            </h3>
            <p className="text-slate-500 text-sm mt-0.5">Send emails from Automations, Campaigns, and lead pages</p>
          </div>
          <Badge ok={smtpOk} label="SMTP" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>SMTP Host</label>
            <input type="text" value={smtp.host} onChange={(e) => setSmtp((f) => ({ ...f, host: e.target.value }))} className={inputCls} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className={labelCls}>Port</label>
            <input type="text" value={smtp.port} onChange={(e) => setSmtp((f) => ({ ...f, port: e.target.value }))} className={inputCls} placeholder="587" />
          </div>
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" value={smtp.user} onChange={(e) => setSmtp((f) => ({ ...f, user: e.target.value }))} className={inputCls} placeholder="you@gmail.com" />
          </div>
          <div>
            <label className={labelCls}>Password / App Password</label>
            <input type="password" value={smtp.pass} onChange={(e) => setSmtp((f) => ({ ...f, pass: e.target.value }))} className={inputCls} placeholder="••••••••" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>From Address <span className="normal-case font-normal text-slate-400">(optional)</span></label>
            <input type="text" value={smtp.from} onChange={(e) => setSmtp((f) => ({ ...f, from: e.target.value }))} className={inputCls} placeholder="Company Name <you@gmail.com>" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">For Gmail, use an App Password with 2FA enabled. Port 587 (TLS) or 465 (SSL).</p>
          <SaveBtn platform="email_smtp" config={smtp} />
        </div>
      </div>

      {/* ── Google Calendar ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" /> Google Calendar
            </h3>
            <p className="text-slate-500 text-sm mt-0.5">Appointments sync automatically to your Google Calendar</p>
          </div>
          <Badge ok={gcalConnected} label="Google Calendar" />
        </div>
        {gcalConnected ? (
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
            <div>
              <p className="text-sm font-medium text-green-800">Connected</p>
              {gcalEmail && <p className="text-xs text-green-600 mt-0.5">{gcalEmail}</p>}
            </div>
            <button onClick={() => disconnect('google_calendar')} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">Disconnect</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Requires <code className="bg-slate-100 px-1 rounded">GOOGLE_CALENDAR_CLIENT_ID</code> and{' '}
              <code className="bg-slate-100 px-1 rounded">GOOGLE_CALENDAR_CLIENT_SECRET</code> env vars.
              Set redirect URI to <code className="bg-slate-100 px-1 rounded">{'{your-url}'}/api/calendar/callback</code>.
            </p>
            <Link href="/api/calendar/connect" className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
              <CalendarDays className="w-4 h-4" /> Connect Google Calendar
            </Link>
          </div>
        )}
      </div>

      {/* ── Google Analytics 4 ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Google Analytics 4
            </h3>
            <p className="text-slate-500 text-sm mt-0.5">Send lead events and pull traffic reports</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge ok={ga4Ok} label="Event tracking" />
            <Badge ok={gaReportOk} label="Reporting" />
          </div>
        </div>

        {/* Event tracking */}
        <SubHeading>Event Tracking — Measurement Protocol</SubHeading>
        <p className="text-xs text-slate-500 mb-3">
          Sends a <code className="bg-slate-100 px-1 rounded">generate_lead</code> event each time a lead is received.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className={labelCls}>Measurement ID</label>
            <input type="text" value={ga4.measurementId} onChange={(e) => setGa4((f) => ({ ...f, measurementId: e.target.value }))} className={inputCls} placeholder="G-XXXXXXXXXX" />
          </div>
          <div>
            <label className={labelCls}>API Secret</label>
            <input type="password" value={ga4.apiSecret} onChange={(e) => setGa4((f) => ({ ...f, apiSecret: e.target.value }))} className={inputCls} placeholder="••••••••" />
          </div>
        </div>
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-slate-400">GA4 → Admin → Data Streams → your stream → Measurement Protocol API secrets</p>
          <SaveBtn platform="google_ga4" config={ga4} />
        </div>

        <div className="border-t border-slate-100 pt-5">
          <SubHeading>Reporting — Analytics Data API</SubHeading>
          <p className="text-xs text-slate-500 mb-3">Pulls sessions, users, and pageview data into the Analytics page.</p>
          {gaReportOk ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div>
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  {gaReportEmail && <p className="text-xs text-green-600 mt-0.5">{gaReportEmail}</p>}
                </div>
                <button onClick={() => disconnect('google_analytics')} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">Disconnect</button>
              </div>
              <div>
                <label className={labelCls}>GA4 Property ID</label>
                <input type="text" value={gaReport.propertyId} onChange={(e) => setGaReport((f) => ({ ...f, propertyId: e.target.value }))} className={inputCls} placeholder="123456789" />
                <p className="text-xs text-slate-400 mt-1">GA4 → Admin → Property → Property details → Property ID</p>
              </div>
              <div className="flex justify-end">
                <SaveBtn platform="google_analytics" config={gaReport} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Requires <code className="bg-slate-100 px-1 rounded">GOOGLE_ANALYTICS_CLIENT_ID</code> and{' '}
                <code className="bg-slate-100 px-1 rounded">GOOGLE_ANALYTICS_CLIENT_SECRET</code> env vars.
                Set redirect URI to <code className="bg-slate-100 px-1 rounded">{'{your-url}'}/api/analytics/google/callback</code>.
              </p>
              <Link href="/api/analytics/google/connect" className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                <TrendingUp className="w-4 h-4" /> Connect Google Analytics
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Google Ads ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Google Ads</h3>
            <p className="text-slate-500 text-sm mt-0.5">Upload offline conversions and pull campaign performance into Analytics</p>
          </div>
          <Badge ok={adsOk} label="Google Ads" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {([
            { key: 'developerToken',             label: 'Developer Token',                    placeholder: 'ABcDeFgHiJkLmNo',            secret: true  },
            { key: 'customerId',                 label: 'Customer ID',                        placeholder: '123-456-7890',               secret: false },
            { key: 'clientId',                   label: 'OAuth Client ID',                    placeholder: 'xxx.apps.googleusercontent.com', secret: false },
            { key: 'clientSecret',               label: 'OAuth Client Secret',                placeholder: 'GOCSPX-…',                  secret: true  },
            { key: 'refreshToken',               label: 'Refresh Token',                      placeholder: '1//…',                      secret: true  },
            { key: 'conversionActionId',         label: 'Conversion Action ID',               placeholder: '1234567890 — manual push',  secret: false },
            { key: 'qualifiedConversionActionId',label: 'Qualified Lead Conversion Action ID',placeholder: '1234567890 — auto on Qualified', secret: false },
            { key: 'wonConversionActionId',      label: 'Won Lead Conversion Action ID',      placeholder: '1234567890 — auto on Won',  secret: false },
          ] as { key: keyof typeof ads; label: string; placeholder: string; secret: boolean }[]).map(({ key, label, placeholder, secret }) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <input type={secret ? 'password' : 'text'} value={ads[key]} onChange={(e) => setAds((f) => ({ ...f, [key]: e.target.value }))} className={inputCls} placeholder={placeholder} />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <SaveBtn platform="google_ads" config={ads} />
        </div>
      </div>

      {/* ── Meta / Facebook ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Meta / Facebook</h3>
            <p className="text-slate-500 text-sm mt-0.5">Send server-side lead events and pull ad campaign performance into Analytics</p>
          </div>
          <Badge ok={fbOk} label="Meta" />
        </div>

        <SubHeading>Conversions API</SubHeading>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className={labelCls}>Pixel ID</label>
            <input type="text" value={fb.pixelId} onChange={(e) => setFb((f) => ({ ...f, pixelId: e.target.value }))} className={inputCls} placeholder="1234567890123456" />
          </div>
          <div>
            <label className={labelCls}>Access Token</label>
            <input type="password" value={fb.accessToken} onChange={(e) => setFb((f) => ({ ...f, accessToken: e.target.value }))} className={inputCls} placeholder="••••••••" />
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-5">Meta Events Manager → your Pixel → Settings → Conversions API → Generate access token</p>

        <div className="border-t border-slate-100 pt-5">
          <SubHeading>Ads Reporting</SubHeading>
          <p className="text-xs text-slate-500 mb-3">Pulls spend, impressions, clicks, and lead data into the Analytics page. The access token above must have <code className="bg-slate-100 px-1 rounded">ads_read</code> permission.</p>
          <div>
            <label className={labelCls}>Ad Account ID</label>
            <input type="text" value={fb.adAccountId} onChange={(e) => setFb((f) => ({ ...f, adAccountId: e.target.value }))} className={inputCls} placeholder="123456789" />
            <p className="text-xs text-slate-400 mt-1">Meta Ads Manager → Ad Account → Account ID (numbers only, without &ldquo;act_&rdquo;)</p>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <SaveBtn platform="facebook" config={fb} />
        </div>
      </div>
    </div>
  )
}
