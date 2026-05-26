'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Save, CalendarDays, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface IntegrationsFormProps {
  accountId: string
  initialConfigs: Record<string, Record<string, string>>
}

function isConfigured(config: Record<string, string> | undefined, keys: string[]) {
  return !!config && keys.every((k) => !!config[k]?.trim())
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{children}</p>
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-green-600' : 'text-slate-400'}`}>
      {ok
        ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
        : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
      {ok ? 'Connected' : 'Not connected'}
    </span>
  )
}

function AccordionItem({
  id, title, description, ok, open, onToggle, children,
}: {
  id: string; title: string; description: string; ok: boolean
  open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${ok ? 'border-green-200' : 'border-slate-200'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${ok ? 'bg-green-50/50 hover:bg-green-50' : 'bg-white hover:bg-slate-50'}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900 text-sm">{title}</span>
            <StatusDot ok={ok} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 py-5 border-t border-slate-100 bg-white">{children}</div>}
    </div>
  )
}

export default function IntegrationsForm({ accountId, initialConfigs }: IntegrationsFormProps) {
  const [ga4, setGa4] = useState({ measurementId: initialConfigs.google_ga4?.measurementId ?? '', apiSecret: initialConfigs.google_ga4?.apiSecret ?? '' })
  const [gaReport, setGaReport] = useState({ propertyId: initialConfigs.google_analytics?.propertyId ?? '', refreshToken: initialConfigs.google_analytics?.refreshToken ?? '', email: initialConfigs.google_analytics?.email ?? '' })
  const [ads, setAds] = useState({ customerId: initialConfigs.google_ads?.customerId ?? '', conversionActionId: initialConfigs.google_ads?.conversionActionId ?? '', qualifiedConversionActionId: initialConfigs.google_ads?.qualifiedConversionActionId ?? '', wonConversionActionId: initialConfigs.google_ads?.wonConversionActionId ?? '' })
  const [fb, setFb] = useState({ pixelId: initialConfigs.facebook?.pixelId ?? '', accessToken: initialConfigs.facebook?.accessToken ?? '', adAccountId: initialConfigs.facebook?.adAccountId ?? '' })
  const [sm8, setSm8] = useState({ apiKey: initialConfigs.servicem8?.apiKey ?? '' })
  const [trak, setTrak] = useState({ apiKey: initialConfigs.trak?.apiKey ?? '' })
  const [aroflo, setAroflo] = useState({ uEncoded: initialConfigs.aroflo?.uEncoded ?? '', pEncoded: initialConfigs.aroflo?.pEncoded ?? '', orgEncoded: initialConfigs.aroflo?.orgEncoded ?? '', secretKey: initialConfigs.aroflo?.secretKey ?? '', taskType: initialConfigs.aroflo?.taskType ?? '' })

  const [saveState, setSaveState] = useState<Record<string, SaveState>>({
    google_ga4: 'idle', google_analytics: 'idle',
    google_ads: 'idle', facebook: 'idle', servicem8: 'idle', aroflo: 'idle', trak: 'idle',
  })

  const [open, setOpen] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

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
          : s === 'saved' ? <><CheckCircle className="w-4 h-4" /> Saved!</>
          : s === 'error' ? <><XCircle className="w-4 h-4" /> Error — Retry</>
          : <><Save className="w-4 h-4" /> Save</>}
      </button>
    )
  }

  function DisconnectBtn({ platform }: { platform: string }) {
    return (
      <button onClick={() => disconnect(platform)} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">
        Disconnect
      </button>
    )
  }

  const sm8Ok      = !!sm8.apiKey.trim()
  const trakOk     = !!trak.apiKey.trim()
  const arofloOk   = !!(aroflo.uEncoded.trim() && aroflo.pEncoded.trim() && aroflo.orgEncoded.trim() && aroflo.secretKey.trim())
  const ga4Ok      = isConfigured(ga4, ['measurementId', 'apiSecret'])
  const gaReportOk = !!initialConfigs.google_analytics?.refreshToken
  const adsOk      = isConfigured(ads, ['customerId'])
  const fbOk       = isConfigured(fb, ['pixelId', 'accessToken'])
  const gcalOk     = !!initialConfigs.google_calendar?.refreshToken
  const gcalEmail  = initialConfigs.google_calendar?.email
  const gaEmail    = initialConfigs.google_analytics?.email

  return (
    <div className="space-y-8">

      {/* ── Job Platforms ──────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Job Platforms</h3>
        <div className="space-y-2">

          <AccordionItem id="servicem8" title="ServiceM8" description="Push leads as client + quote job — no double entry" ok={sm8Ok} open={open.has('servicem8')} onToggle={() => toggle('servicem8')}>
            <div className="mb-4">
              <label className={labelCls}>API Key</label>
              <input type="password" value={sm8.apiKey} onChange={(e) => setSm8({ apiKey: e.target.value })} className={inputCls} placeholder="smk-xxxxxx-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx" />
              <p className="text-xs text-slate-400 mt-1.5">ServiceM8 → Settings → Developer → API Keys → Generate key</p>
            </div>
            <div className="flex items-center justify-between">
              {sm8Ok && <DisconnectBtn platform="servicem8" />}
              <div className="ml-auto"><SaveBtn platform="servicem8" config={sm8} /></div>
            </div>
          </AccordionItem>

          <AccordionItem id="trak" title="Trak" description="Push leads as contact + job — no double entry" ok={trakOk} open={open.has('trak')} onToggle={() => toggle('trak')}>
            <div className="mb-4">
              <label className={labelCls}>API v2 Key</label>
              <input type="password" value={trak.apiKey} onChange={(e) => setTrak({ apiKey: e.target.value })} className={inputCls} placeholder="tt_••••••••••••••••••••••" />
              <p className="text-xs text-slate-400 mt-1.5">Trak → Company Settings → Data Management → API Settings → <strong>API v2 Auth Key</strong></p>
            </div>
            <div className="flex items-center justify-between">
              {trakOk && <DisconnectBtn platform="trak" />}
              <div className="ml-auto"><SaveBtn platform="trak" config={trak} /></div>
            </div>
          </AccordionItem>

          <AccordionItem id="aroflo" title="AroFlo" description="Push leads as client + task — no double entry" ok={arofloOk} open={open.has('aroflo')} onToggle={() => toggle('aroflo')}>
            <p className="text-xs text-slate-500 mb-4">AroFlo → Site Administration → Settings → General → AroFlo API</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {([
                { key: 'uEncoded',   label: 'uENCODE',    placeholder: 'uENCODE value',    secret: false },
                { key: 'pEncoded',   label: 'pENCODE',    placeholder: 'pENCODE / Key ID', secret: false },
                { key: 'orgEncoded', label: 'orgENCODE',  placeholder: 'orgENCODE value',  secret: false },
                { key: 'secretKey',  label: 'Secret Key', placeholder: '••••••••',         secret: true  },
              ] as { key: keyof typeof aroflo; label: string; placeholder: string; secret: boolean }[]).map(({ key, label, placeholder, secret }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input type={secret ? 'password' : 'text'} value={aroflo[key]} onChange={(e) => setAroflo((f) => ({ ...f, [key]: e.target.value }))} className={inputCls} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className={labelCls}>Default Task Type <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
              <input type="text" value={aroflo.taskType} onChange={(e) => setAroflo((f) => ({ ...f, taskType: e.target.value }))} className={inputCls} placeholder="e.g. Electrical, Plumbing, Quote — must match your AroFlo task types exactly" />
            </div>
            <div className="flex items-center justify-between">
              {arofloOk && <DisconnectBtn platform="aroflo" />}
              <div className="ml-auto"><SaveBtn platform="aroflo" config={aroflo} /></div>
            </div>
          </AccordionItem>

        </div>
      </div>

      {/* ── Analytics & Conversions ─────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Analytics & Conversions</h3>
        <div className="space-y-2">

          <AccordionItem id="google_ga4" title="Google Analytics 4" description="Send lead events and pull traffic reports" ok={ga4Ok || gaReportOk} open={open.has('google_ga4')} onToggle={() => toggle('google_ga4')}>
            <SubHeading>Event Tracking — Measurement Protocol</SubHeading>
            <p className="text-xs text-slate-500 mb-3">Sends a <code className="bg-slate-100 px-1 rounded">generate_lead</code> event each time a lead is received.</p>
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
                      {gaEmail && <p className="text-xs text-green-600 mt-0.5">{gaEmail}</p>}
                    </div>
                    <button onClick={() => disconnect('google_analytics')} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">Disconnect</button>
                  </div>
                  <div>
                    <label className={labelCls}>GA4 Property ID</label>
                    <input type="text" value={gaReport.propertyId} onChange={(e) => setGaReport((f) => ({ ...f, propertyId: e.target.value }))} className={inputCls} placeholder="123456789" />
                    <p className="text-xs text-slate-400 mt-1">GA4 → Admin → Property → Property details → Property ID</p>
                  </div>
                  <div className="flex justify-end"><SaveBtn platform="google_analytics" config={gaReport} /></div>
                </div>
              ) : (
                <Link href={`/api/analytics/google/connect${accountId ? `?account=${accountId}` : ''}`} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                  <TrendingUp className="w-4 h-4" /> Connect Google Analytics
                </Link>
              )}
            </div>
          </AccordionItem>

          <AccordionItem id="google_ads" title="Google Ads" description="Upload offline conversions and pull campaign performance" ok={adsOk} open={open.has('google_ads')} onToggle={() => toggle('google_ads')}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {([
                { key: 'customerId',                  label: 'Customer ID',                         placeholder: '123-456-7890' },
                { key: 'conversionActionId',          label: 'Conversion Action ID',                placeholder: '1234567890 — manual push' },
                { key: 'qualifiedConversionActionId', label: 'Qualified Lead Conversion Action ID',  placeholder: '1234567890 — auto on Qualified' },
                { key: 'wonConversionActionId',       label: 'Won Lead Conversion Action ID',        placeholder: '1234567890 — auto on Won' },
              ] as { key: keyof typeof ads; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input type="text" value={ads[key]} onChange={(e) => setAds((f) => ({ ...f, [key]: e.target.value }))} className={inputCls} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <div className="flex justify-end"><SaveBtn platform="google_ads" config={ads} /></div>
          </AccordionItem>

          <AccordionItem id="facebook" title="Meta / Facebook" description="Send server-side lead events and pull ad campaign performance" ok={fbOk} open={open.has('facebook')} onToggle={() => toggle('facebook')}>
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
            <div className="flex justify-end mt-4"><SaveBtn platform="facebook" config={fb} /></div>
          </AccordionItem>

        </div>
      </div>

      {/* ── Utilities ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Utilities</h3>
        <div className="space-y-2">

          <AccordionItem id="google_calendar" title="Google Calendar" description="Appointments sync automatically to your Google Calendar" ok={gcalOk} open={open.has('google_calendar')} onToggle={() => toggle('google_calendar')}>
            {gcalOk ? (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div>
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  {gcalEmail && <p className="text-xs text-green-600 mt-0.5">{gcalEmail}</p>}
                </div>
                <button onClick={() => disconnect('google_calendar')} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">Disconnect</button>
              </div>
            ) : (
              <Link href={`/api/calendar/connect${accountId ? `?account=${accountId}` : ''}`} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                <CalendarDays className="w-4 h-4" /> Connect Google Calendar
              </Link>
            )}
          </AccordionItem>

        </div>
      </div>

    </div>
  )
}
