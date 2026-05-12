'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Save, CalendarDays, Mail } from 'lucide-react'
import Link from 'next/link'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface IntegrationsFormProps {
  accountId: string
  initialConfigs: Record<string, Record<string, string>>
}

function isConfigured(config: Record<string, string> | undefined, keys: string[]) {
  return !!config && keys.every((k) => !!config[k]?.trim())
}

function IntegrationBadge({ configured, label }: { configured: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
      configured ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
    }`}>
      {configured
        ? <CheckCircle className="w-4 h-4 text-green-500" />
        : <XCircle className="w-4 h-4 text-slate-400" />}
      {configured ? `${label} configured` : `${label} not configured`}
    </div>
  )
}

export default function IntegrationsForm({ accountId, initialConfigs }: IntegrationsFormProps) {
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  const [ga4, setGa4] = useState({
    measurementId: initialConfigs.google_ga4?.measurementId ?? '',
    apiSecret: initialConfigs.google_ga4?.apiSecret ?? '',
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
  })

  const [smtp, setSmtp] = useState({
    host: initialConfigs.email_smtp?.host ?? '',
    port: initialConfigs.email_smtp?.port ?? '587',
    user: initialConfigs.email_smtp?.user ?? '',
    pass: initialConfigs.email_smtp?.pass ?? '',
    from: initialConfigs.email_smtp?.from ?? '',
  })

  const [saveState, setSaveState] = useState<Record<string, SaveState>>({
    google_ga4: 'idle',
    google_ads: 'idle',
    facebook: 'idle',
    email_smtp: 'idle',
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

  function SaveBtn({ platform, config }: { platform: string; config: Record<string, string> }) {
    const state = saveState[platform]
    return (
      <button
        onClick={() => saveIntegration(platform, config)}
        disabled={state === 'saving'}
        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {state === 'saving' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : state === 'saved' ? (
          <><CheckCircle className="w-4 h-4" /> Saved!</>
        ) : state === 'error' ? (
          <><XCircle className="w-4 h-4" /> Error — Retry</>
        ) : (
          <><Save className="w-4 h-4" /> Save</>
        )}
      </button>
    )
  }

  const smtpOk = isConfigured(smtp, ['host', 'user', 'pass'])
  const ga4Ok = isConfigured(ga4, ['measurementId', 'apiSecret'])
  const adsOk = isConfigured(ads, ['developerToken', 'customerId', 'clientId', 'clientSecret', 'refreshToken'])
  const fbOk = isConfigured(fb, ['pixelId', 'accessToken'])
  const gcalEmail = initialConfigs.google_calendar?.email
  const gcalConnected = !!initialConfigs.google_calendar?.refreshToken

  async function disconnectGCal() {
    await fetch(`/api/accounts/${accountId}/integrations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'google_calendar', config: {}, enabled: false }),
    })
    window.location.reload()
  }

  return (
    <>
      {/* SMTP Email */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email (SMTP)
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">Used by Automations to send emails to leads</p>
          </div>
          <IntegrationBadge configured={smtpOk} label="SMTP" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">SMTP Host</label>
            <input type="text" value={smtp.host} onChange={(e) => setSmtp((f) => ({ ...f, host: e.target.value }))} className={inputCls} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Port</label>
            <input type="text" value={smtp.port} onChange={(e) => setSmtp((f) => ({ ...f, port: e.target.value }))} className={inputCls} placeholder="587" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Username</label>
            <input type="text" value={smtp.user} onChange={(e) => setSmtp((f) => ({ ...f, user: e.target.value }))} className={inputCls} placeholder="you@gmail.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Password / App Password</label>
            <input type="password" value={smtp.pass} onChange={(e) => setSmtp((f) => ({ ...f, pass: e.target.value }))} className={inputCls} placeholder="••••••••" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">From Address (optional)</label>
            <input type="text" value={smtp.from} onChange={(e) => setSmtp((f) => ({ ...f, from: e.target.value }))} className={inputCls} placeholder="Company Name <you@gmail.com>" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">For Gmail, use an App Password with 2FA enabled. Port 587 (TLS) or 465 (SSL).</p>
          <SaveBtn platform="email_smtp" config={smtp} />
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              Google Calendar
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">Appointments sync automatically to your Google Calendar</p>
          </div>
          <IntegrationBadge configured={gcalConnected} label="Google Calendar" />
        </div>
        {gcalConnected ? (
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
            <div>
              <p className="text-sm font-medium text-green-800">Connected</p>
              {gcalEmail && <p className="text-xs text-green-600 mt-0.5">{gcalEmail}</p>}
            </div>
            <button
              onClick={disconnectGCal}
              className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Requires <code className="bg-slate-100 px-1 rounded">GOOGLE_CALENDAR_CLIENT_ID</code> and{' '}
              <code className="bg-slate-100 px-1 rounded">GOOGLE_CALENDAR_CLIENT_SECRET</code> in your environment.
              Set the redirect URI to <code className="bg-slate-100 px-1 rounded">{'{your-url}'}/api/calendar/callback</code> in Google Cloud Console.
            </p>
            <Link
              href="/api/calendar/connect"
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              Connect Google Calendar
            </Link>
          </div>
        )}
      </div>

      {/* GA4 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Google Analytics 4</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Sends a <code className="text-xs bg-slate-100 px-1 rounded">generate_lead</code> event via Measurement Protocol
            </p>
          </div>
          <IntegrationBadge configured={ga4Ok} label="GA4" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Measurement ID</label>
            <input
              type="text"
              value={ga4.measurementId}
              onChange={(e) => setGa4((f) => ({ ...f, measurementId: e.target.value }))}
              className={inputCls}
              placeholder="G-XXXXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">API Secret</label>
            <input
              type="password"
              value={ga4.apiSecret}
              onChange={(e) => setGa4((f) => ({ ...f, apiSecret: e.target.value }))}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            GA4 → Admin → Data Streams → your stream → Measurement Protocol API secrets
          </p>
          <SaveBtn platform="google_ga4" config={ga4} />
        </div>
      </div>

      {/* Google Ads */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Google Ads Offline Conversions</h2>
            <p className="text-slate-500 text-sm mt-0.5">Uploads click conversions — lead must have a gclid</p>
          </div>
          <IntegrationBadge configured={adsOk} label="Google Ads" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {([
            { key: 'developerToken', label: 'Developer Token', placeholder: 'ABcDeFgHiJkLmNo', secret: true },
            { key: 'customerId', label: 'Customer ID', placeholder: '123-456-7890', secret: false },
            { key: 'clientId', label: 'OAuth Client ID', placeholder: 'xxx.apps.googleusercontent.com', secret: false },
            { key: 'clientSecret', label: 'OAuth Client Secret', placeholder: 'GOCSPX-…', secret: true },
            { key: 'refreshToken', label: 'Refresh Token', placeholder: '1//…', secret: true },
            { key: 'conversionActionId', label: 'Conversion Action ID (manual push)', placeholder: '1234567890', secret: false },
            { key: 'qualifiedConversionActionId', label: 'Qualified Lead Conversion Action ID', placeholder: '1234567890 — auto-fires when moved to Qualified', secret: false },
            { key: 'wonConversionActionId', label: 'Converted Lead Conversion Action ID', placeholder: '1234567890 — auto-fires when moved to Won', secret: false },
          ] as { key: keyof typeof ads; label: string; placeholder: string; secret: boolean }[]).map(({ key, label, placeholder, secret }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
              <input
                type={secret ? 'password' : 'text'}
                value={ads[key]}
                onChange={(e) => setAds((f) => ({ ...f, [key]: e.target.value }))}
                className={inputCls}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <SaveBtn platform="google_ads" config={ads} />
        </div>
      </div>

      {/* Facebook */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Meta / Facebook Conversions API</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Sends a server-side <code className="text-xs bg-slate-100 px-1 rounded">Lead</code> event with hashed PII
            </p>
          </div>
          <IntegrationBadge configured={fbOk} label="Facebook" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Pixel ID</label>
            <input
              type="text"
              value={fb.pixelId}
              onChange={(e) => setFb((f) => ({ ...f, pixelId: e.target.value }))}
              className={inputCls}
              placeholder="1234567890123456"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Access Token</label>
            <input
              type="password"
              value={fb.accessToken}
              onChange={(e) => setFb((f) => ({ ...f, accessToken: e.target.value }))}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Meta Events Manager → your Pixel → Settings → Conversions API → Generate access token
          </p>
          <SaveBtn platform="facebook" config={fb} />
        </div>
      </div>
    </>
  )
}
