'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, Save, CalendarDays, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Mail } from 'lucide-react'
import Link from 'next/link'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface IntegrationsFormProps {
  accountId: string
  initialConfigs: Record<string, Record<string, string>>
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-green-600' : 'text-slate-400'}`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
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

function ConnectedBadge({ label, onDisconnect }: { label: string; onDisconnect: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100 mb-5">
      <div>
        <p className="text-sm font-medium text-green-800">Connected</p>
        {label && <p className="text-xs text-green-600 mt-0.5">{label}</p>}
      </div>
      <button onClick={onDisconnect} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">
        Disconnect
      </button>
    </div>
  )
}

function OAuthConnectButton({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
    >
      {icon}
      {label}
      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
    </Link>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{children}</p>
}

function SaveBtn({ platform, config, onSave }: { platform: string; config: Record<string, string>; onSave: (p: string, c: Record<string, string>) => Promise<void> }) {
  const [state, setState] = useState<SaveState>('idle')
  async function click() {
    setState('saving')
    try {
      await onSave(platform, config)
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }
  return (
    <button
      onClick={click}
      disabled={state === 'saving'}
      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
    >
      {state === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        : state === 'saved' ? <><CheckCircle className="w-4 h-4" /> Saved!</>
        : state === 'error' ? <><XCircle className="w-4 h-4" /> Error — Retry</>
        : <><Save className="w-4 h-4" /> Save</>}
    </button>
  )
}

type GscSite = { siteUrl: string; permissionLevel: string }
type AdsCustomer = { customerId: string }
type Ga4Property = { propertyId: string; displayName: string }
type MetaAdAccount = { id: string; name: string }

export default function IntegrationsForm({ accountId, initialConfigs }: IntegrationsFormProps) {
  // ── Google ─────────────────────────────────────────────────────────────
  const googleConnected = initialConfigs.google?.connected === 'true'
  const googleEmail = initialConfigs.google?.email ?? ''

  // Also detect legacy separate google_analytics / google_calendar connections
  const gaReportOk = googleConnected || !!initialConfigs.google_analytics?.refreshToken
  const gcalOk = googleConnected || !!initialConfigs.google_calendar?.refreshToken
  const gcalEmail = initialConfigs.google_calendar?.email ?? initialConfigs.google?.email ?? ''

  const [ads, setAds] = useState({
    customerId: initialConfigs.google_ads?.customerId ?? '',
    conversionActionId: initialConfigs.google_ads?.conversionActionId ?? '',
    qualifiedConversionActionId: initialConfigs.google_ads?.qualifiedConversionActionId ?? '',
    wonConversionActionId: initialConfigs.google_ads?.wonConversionActionId ?? '',
  })
  const [ga4Report, setGa4Report] = useState({ propertyId: initialConfigs.google_analytics?.propertyId ?? '' })
  const [ga4, setGa4] = useState({
    measurementId: initialConfigs.google_ga4?.measurementId ?? '',
    apiSecret: initialConfigs.google_ga4?.apiSecret ?? '',
  })
  const [gsc, setGsc] = useState({ siteUrl: initialConfigs.google_search_console?.siteUrl ?? '' })

  const [googleResources, setGoogleResources] = useState<{
    adsCustomers: AdsCustomer[]; ga4Properties: Ga4Property[]; gscSites: GscSite[]
  } | null>(null)
  const [loadingResources, setLoadingResources] = useState(false)

  async function loadGoogleResources() {
    setLoadingResources(true)
    const qs = accountId ? `?account=${accountId}` : ''
    const res = await fetch(`/api/integrations/google/resources${qs}`)
    if (res.ok) setGoogleResources(await res.json())
    setLoadingResources(false)
  }

  useEffect(() => {
    if (googleConnected && !googleResources) loadGoogleResources()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected])

  // ── Meta ───────────────────────────────────────────────────────────────
  const metaConnected = initialConfigs.meta?.connected === 'true'
  const metaUserName = initialConfigs.meta?.userName ?? ''
  const metaAdAccounts: MetaAdAccount[] = (() => {
    try { return JSON.parse(initialConfigs.meta?.adAccounts ?? '[]') } catch { return [] }
  })()

  const [fb, setFb] = useState({
    pixelId: initialConfigs.facebook?.pixelId ?? '',
    adAccountId: initialConfigs.facebook?.adAccountId ?? '',
  })

  // ── LinkedIn ───────────────────────────────────────────────────────────
  const linkedinConnected = initialConfigs.linkedin?.connected === 'true'
  const linkedinPersonName = initialConfigs.linkedin?.personName ?? ''
  const linkedinOrgs: { id: string; name: string }[] = (() => {
    try { return JSON.parse(initialConfigs.linkedin?.organizations ?? '[]') } catch { return [] }
  })()

  // ── Email sync ───────────────────────────────────────────────────────────
  const gmailConnected = initialConfigs.gmail?.connected === 'true'
  const gmailEmail = initialConfigs.gmail?.email ?? ''
  const outlookConnected = initialConfigs.outlook?.connected === 'true'
  const outlookEmail = initialConfigs.outlook?.email ?? ''

  // ── Job platforms ──────────────────────────────────────────────────────
  const [sm8, setSm8] = useState({ apiKey: initialConfigs.servicem8?.apiKey ?? '' })
  const [trak, setTrak] = useState({ apiKey: initialConfigs.trak?.apiKey ?? '' })
  const [aroflo, setAroflo] = useState({
    uEncoded: initialConfigs.aroflo?.uEncoded ?? '',
    pEncoded: initialConfigs.aroflo?.pEncoded ?? '',
    orgEncoded: initialConfigs.aroflo?.orgEncoded ?? '',
    secretKey: initialConfigs.aroflo?.secretKey ?? '',
    taskType: initialConfigs.aroflo?.taskType ?? '',
  })

  // ── Messaging ────────────────────────────────────────────────────────────
  const [whatsapp, setWhatsapp] = useState({
    phoneNumberId: initialConfigs.whatsapp?.phoneNumberId ?? '',
    accessToken: initialConfigs.whatsapp?.accessToken ?? '',
    wabaId: initialConfigs.whatsapp?.wabaId ?? '',
  })

  const [open, setOpen] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function saveIntegration(platform: string, config: Record<string, string>) {
    const res = await fetch(`/api/accounts/${accountId}/integrations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, config, enabled: true }),
    })
    if (!res.ok) throw new Error('Save failed')
  }

  async function disconnect(platform: string) {
    await fetch(`/api/accounts/${accountId}/integrations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, config: {}, enabled: false }),
    })
    window.location.reload()
  }

  const adsOk = !!ads.customerId.trim()
  const ga4Ok = !!(ga4.measurementId.trim() && ga4.apiSecret.trim())
  const sm8Ok = !!sm8.apiKey.trim()
  const trakOk = !!trak.apiKey.trim()
  const arofloOk = !!(aroflo.uEncoded.trim() && aroflo.pEncoded.trim() && aroflo.orgEncoded.trim() && aroflo.secretKey.trim())
  const whatsappOk = !!(whatsapp.phoneNumberId.trim() && whatsapp.accessToken.trim())
  const fbOk = !!(metaConnected || (fb.pixelId.trim() && fb.adAccountId.trim()))
  const acctQs = accountId ? `?account=${accountId}` : ''

  return (
    <div className="space-y-8">

      {/* ── Job Platforms ───────────────────────────────────────────── */}
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
              {sm8Ok && <button onClick={() => disconnect('servicem8')} className="text-xs text-red-500 hover:text-red-600 font-medium">Disconnect</button>}
              <div className="ml-auto"><SaveBtn platform="servicem8" config={sm8} onSave={saveIntegration} /></div>
            </div>
          </AccordionItem>

          <AccordionItem id="trak" title="Trak" description="Push leads as contact + job — no double entry" ok={trakOk} open={open.has('trak')} onToggle={() => toggle('trak')}>
            <div className="mb-4">
              <label className={labelCls}>API v2 Key</label>
              <input type="password" value={trak.apiKey} onChange={(e) => setTrak({ apiKey: e.target.value })} className={inputCls} placeholder="tt_••••••••••••••••••••••" />
              <p className="text-xs text-slate-400 mt-1.5">Trak → Company Settings → Data Management → API Settings → <strong>API v2 Auth Key</strong></p>
            </div>
            <div className="flex items-center justify-between">
              {trakOk && <button onClick={() => disconnect('trak')} className="text-xs text-red-500 hover:text-red-600 font-medium">Disconnect</button>}
              <div className="ml-auto"><SaveBtn platform="trak" config={trak} onSave={saveIntegration} /></div>
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
              <input type="text" value={aroflo.taskType} onChange={(e) => setAroflo((f) => ({ ...f, taskType: e.target.value }))} className={inputCls} placeholder="e.g. Electrical, Plumbing, Quote" />
            </div>
            <div className="flex items-center justify-between">
              {arofloOk && <button onClick={() => disconnect('aroflo')} className="text-xs text-red-500 hover:text-red-600 font-medium">Disconnect</button>}
              <div className="ml-auto"><SaveBtn platform="aroflo" config={aroflo} onSave={saveIntegration} /></div>
            </div>
          </AccordionItem>

        </div>
      </div>

      {/* ── Messaging ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Messaging</h3>
        <div className="space-y-2">

          <AccordionItem id="whatsapp" title="WhatsApp Business" description="Two-way WhatsApp messaging on lead records" ok={whatsappOk} open={open.has('whatsapp')} onToggle={() => toggle('whatsapp')}>
            <p className="text-xs text-slate-500 mb-4">
              From Meta Business Manager → WhatsApp Business API setup. The webhook URL and verify token are configured once at the app level by your administrator — this only needs the phone number's own credentials.
            </p>
            <div className="space-y-4 mb-4">
              <div>
                <label className={labelCls}>Phone Number ID</label>
                <input type="text" value={whatsapp.phoneNumberId} onChange={(e) => setWhatsapp((f) => ({ ...f, phoneNumberId: e.target.value }))} className={inputCls} placeholder="106540352242922" />
              </div>
              <div>
                <label className={labelCls}>Access Token</label>
                <input type="password" value={whatsapp.accessToken} onChange={(e) => setWhatsapp((f) => ({ ...f, accessToken: e.target.value }))} className={inputCls} placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp Business Account ID <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                <input type="text" value={whatsapp.wabaId} onChange={(e) => setWhatsapp((f) => ({ ...f, wabaId: e.target.value }))} className={inputCls} placeholder="102290129340398" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              {whatsappOk && <button onClick={() => disconnect('whatsapp')} className="text-xs text-red-500 hover:text-red-600 font-medium">Disconnect</button>}
              <div className="ml-auto"><SaveBtn platform="whatsapp" config={whatsapp} onSave={saveIntegration} /></div>
            </div>
          </AccordionItem>

        </div>
      </div>

      {/* ── Analytics & Conversions ─────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Analytics & Conversions</h3>
        <div className="space-y-2">

          {/* ── Google ─── */}
          <AccordionItem
            id="google"
            title="Google"
            description="Google Ads, Analytics 4, Search Console — one-click connect"
            ok={googleConnected}
            open={open.has('google')}
            onToggle={() => toggle('google')}
          >
            {googleConnected ? (
              <ConnectedBadge label={googleEmail} onDisconnect={() => disconnect('google')} />
            ) : (
              <div className="mb-5">
                <p className="text-sm text-slate-600 mb-4">
                  Connect your Google account to enable Google Ads offline conversions, Analytics 4 reporting, and Search Console data — all with one click.
                </p>
                <OAuthConnectButton
                  href={`/api/integrations/google/connect${acctQs}`}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
                  label="Connect Google"
                />
              </div>
            )}

            {/* Google Ads */}
            <div className={`border-t border-slate-100 pt-5 ${!googleConnected ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <SubHeading>Google Ads — Offline Conversions</SubHeading>
                {googleConnected && googleResources && googleResources.adsCustomers.length > 0 && (
                  <select
                    value={ads.customerId}
                    onChange={(e) => setAds((f) => ({ ...f, customerId: e.target.value }))}
                    className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="">Select account…</option>
                    {googleResources.adsCustomers.map((c) => (
                      <option key={c.customerId} value={c.customerId}>{c.customerId}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className={labelCls}>Customer ID</label>
                  <input type="text" value={ads.customerId} onChange={(e) => setAds((f) => ({ ...f, customerId: e.target.value }))} className={inputCls} placeholder="123-456-7890" />
                </div>
                <div>
                  <label className={labelCls}>Conversion Action ID</label>
                  <input type="text" value={ads.conversionActionId} onChange={(e) => setAds((f) => ({ ...f, conversionActionId: e.target.value }))} className={inputCls} placeholder="1234567890" />
                </div>
                <div>
                  <label className={labelCls}>Qualified Lead Conversion ID</label>
                  <input type="text" value={ads.qualifiedConversionActionId} onChange={(e) => setAds((f) => ({ ...f, qualifiedConversionActionId: e.target.value }))} className={inputCls} placeholder="1234567890 — auto on Qualified" />
                </div>
                <div>
                  <label className={labelCls}>Won Lead Conversion ID</label>
                  <input type="text" value={ads.wonConversionActionId} onChange={(e) => setAds((f) => ({ ...f, wonConversionActionId: e.target.value }))} className={inputCls} placeholder="1234567890 — auto on Won" />
                </div>
              </div>
              <div className="flex justify-end mb-1"><SaveBtn platform="google_ads" config={ads} onSave={saveIntegration} /></div>
            </div>

            {/* GA4 Reporting */}
            <div className={`border-t border-slate-100 pt-5 mt-5 ${!googleConnected ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <SubHeading>Google Analytics 4 — Reporting</SubHeading>
                {googleConnected && (
                  <button onClick={loadGoogleResources} disabled={loadingResources} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${loadingResources ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                )}
              </div>
              {googleResources && googleResources.ga4Properties.length > 0 && (
                <div className="mb-3">
                  <label className={labelCls}>Select Property</label>
                  <select
                    value={ga4Report.propertyId}
                    onChange={(e) => setGa4Report({ propertyId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a GA4 property…</option>
                    {googleResources.ga4Properties.map((p) => (
                      <option key={p.propertyId} value={p.propertyId}>{p.displayName}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-3">
                <label className={labelCls}>Property ID</label>
                <input type="text" value={ga4Report.propertyId} onChange={(e) => setGa4Report({ propertyId: e.target.value })} className={inputCls} placeholder="123456789" />
                <p className="text-xs text-slate-400 mt-1">GA4 → Admin → Property details → Property ID</p>
              </div>
              <div className="flex justify-end"><SaveBtn platform="google_analytics" config={ga4Report} onSave={saveIntegration} /></div>
            </div>

            {/* GA4 Event Tracking (Measurement Protocol — no OAuth needed) */}
            <div className="border-t border-slate-100 pt-5 mt-5">
              <SubHeading>Google Analytics 4 — Event Tracking (Measurement Protocol)</SubHeading>
              <p className="text-xs text-slate-500 mb-3">Fires a <code className="bg-slate-100 px-1 rounded">generate_lead</code> event when a lead is received. Does not require the Google OAuth connection above.</p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className={labelCls}>Measurement ID</label>
                  <input type="text" value={ga4.measurementId} onChange={(e) => setGa4((f) => ({ ...f, measurementId: e.target.value }))} className={inputCls} placeholder="G-XXXXXXXXXX" />
                </div>
                <div>
                  <label className={labelCls}>API Secret</label>
                  <input type="password" value={ga4.apiSecret} onChange={(e) => setGa4((f) => ({ ...f, apiSecret: e.target.value }))} className={inputCls} placeholder="••••••••" />
                  <p className="text-xs text-slate-400 mt-1">GA4 → Admin → Data Streams → your stream → Measurement Protocol API secrets</p>
                </div>
              </div>
              <div className="flex justify-end"><SaveBtn platform="google_ga4" config={ga4} onSave={saveIntegration} /></div>
            </div>

            {/* Search Console */}
            <div className={`border-t border-slate-100 pt-5 mt-5 ${!googleConnected ? 'opacity-50 pointer-events-none' : ''}`}>
              <SubHeading>Google Search Console</SubHeading>
              {googleResources && googleResources.gscSites.length > 0 && (
                <div className="mb-3">
                  <label className={labelCls}>Select Site</label>
                  <select
                    value={gsc.siteUrl}
                    onChange={(e) => setGsc({ siteUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a verified site…</option>
                    {googleResources.gscSites.map((s) => (
                      <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-3">
                <label className={labelCls}>Site URL</label>
                <input type="text" value={gsc.siteUrl} onChange={(e) => setGsc({ siteUrl: e.target.value })} className={inputCls} placeholder="https://yourdomain.com.au/" />
              </div>
              <div className="flex justify-end"><SaveBtn platform="google_search_console" config={gsc} onSave={saveIntegration} /></div>
            </div>
          </AccordionItem>

          {/* ── Meta ─── */}
          <AccordionItem
            id="meta"
            title="Meta / Facebook / Instagram"
            description="Meta Ads, Conversions API, Facebook Pages, Instagram — one-click connect"
            ok={fbOk}
            open={open.has('meta')}
            onToggle={() => toggle('meta')}
          >
            {metaConnected ? (
              <ConnectedBadge label={metaUserName} onDisconnect={() => disconnect('meta')} />
            ) : (
              <div className="mb-5">
                <p className="text-sm text-slate-600 mb-4">
                  Connect your Meta account to enable the Conversions API for server-side lead events, Meta Ads reporting, and Facebook/Instagram page management.
                </p>
                <OAuthConnectButton
                  href={`/api/integrations/meta/connect${acctQs}`}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
                  label="Connect Meta"
                />
              </div>
            )}

            <div className={`${!metaConnected ? 'opacity-50 pointer-events-none' : ''}`}>
              <SubHeading>Conversions API</SubHeading>
              <p className="text-xs text-slate-500 mb-3">Sends a server-side <code className="bg-slate-100 px-1 rounded">Lead</code> event each time a lead is received.</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelCls}>Pixel ID</label>
                  <input type="text" value={fb.pixelId} onChange={(e) => setFb((f) => ({ ...f, pixelId: e.target.value }))} className={inputCls} placeholder="1234567890123456" />
                  <p className="text-xs text-slate-400 mt-1">Meta Events Manager → your Pixel → Settings</p>
                </div>
                <div>
                  <label className={labelCls}>Ad Account ID</label>
                  {metaConnected && metaAdAccounts.length > 0 ? (
                    <select
                      value={fb.adAccountId}
                      onChange={(e) => setFb((f) => ({ ...f, adAccountId: e.target.value.replace('act_', '') }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select ad account…</option>
                      {metaAdAccounts.map((a) => (
                        <option key={a.id} value={a.id.replace('act_', '')}>{a.name} ({a.id.replace('act_', '')})</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={fb.adAccountId} onChange={(e) => setFb((f) => ({ ...f, adAccountId: e.target.value }))} className={inputCls} placeholder="123456789" />
                  )}
                  <p className="text-xs text-slate-400 mt-1">Numbers only, without &ldquo;act_&rdquo;</p>
                </div>
              </div>
              <div className="flex justify-end"><SaveBtn platform="facebook" config={fb} onSave={saveIntegration} /></div>
            </div>
          </AccordionItem>

          {/* ── LinkedIn ─── */}
          <AccordionItem
            id="linkedin_ads"
            title="LinkedIn"
            description="LinkedIn Ads, personal profile, and company pages — one-click connect"
            ok={linkedinConnected}
            open={open.has('linkedin_ads')}
            onToggle={() => toggle('linkedin_ads')}
          >
            {linkedinConnected ? (
              <>
                <ConnectedBadge label={linkedinPersonName} onDisconnect={() => disconnect('linkedin')} />
                {linkedinOrgs.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Company Pages</p>
                    <div className="space-y-1">
                      {linkedinOrgs.map((o) => (
                        <div key={o.id} className="flex items-center gap-2 text-sm text-slate-700 px-3 py-2 bg-slate-50 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          {o.name}
                          <span className="text-xs text-slate-400 ml-auto">{o.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {linkedinOrgs.length === 0 && (
                  <p className="text-xs text-slate-500 mb-4">No company pages found. You can still use LinkedIn Ads and personal posting.</p>
                )}
              </>
            ) : (
              <div className="mb-2">
                <p className="text-sm text-slate-600 mb-4">
                  Connect your LinkedIn account for LinkedIn Ads reporting and company page management. Discovers all company pages you administer.
                </p>
                <OAuthConnectButton
                  href={`/api/integrations/linkedin/connect${acctQs}`}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>}
                  label="Connect LinkedIn"
                />
              </div>
            )}
          </AccordionItem>

        </div>
      </div>

      {/* ── Utilities ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Utilities</h3>
        <div className="space-y-2">

          <AccordionItem id="google_calendar" title="Google Calendar" description="Appointments sync automatically to your Google Calendar" ok={gcalOk} open={open.has('google_calendar')} onToggle={() => toggle('google_calendar')}>
            {gcalOk ? (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div>
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  {gcalEmail && <p className="text-xs text-green-600 mt-0.5">{gcalEmail}</p>}
                  {googleConnected && <p className="text-xs text-green-500 mt-0.5">Using your connected Google account</p>}
                </div>
                {!googleConnected && (
                  <button onClick={() => disconnect('google_calendar')} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">Disconnect</button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Connect Google Calendar via the Google integration above, or connect Calendar directly:
                </p>
                <div className="flex gap-3">
                  <Link href={`/api/integrations/google/connect${acctQs}`} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                    <CalendarDays className="w-4 h-4" /> Connect Google (all services)
                  </Link>
                  <Link href={`/api/calendar/connect${acctQs}`} className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                    <CalendarDays className="w-4 h-4" /> Calendar only
                  </Link>
                </div>
              </div>
            )}
          </AccordionItem>

          <AccordionItem id="gmail" title="Gmail" description="Emails from matching leads appear on their timeline automatically" ok={gmailConnected} open={open.has('gmail')} onToggle={() => toggle('gmail')}>
            {gmailConnected ? (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div>
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  {gmailEmail && <p className="text-xs text-green-600 mt-0.5">{gmailEmail}</p>}
                </div>
                <button onClick={() => disconnect('gmail')} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">Disconnect</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Read-only access — the CRM watches your inbox for replies from leads, it doesn't send through your Gmail.
                </p>
                <Link href={`/api/integrations/gmail/connect${acctQs}`} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                  <Mail className="w-4 h-4" /> Connect Gmail
                </Link>
              </div>
            )}
          </AccordionItem>

          <AccordionItem id="outlook" title="Outlook" description="Emails from matching leads appear on their timeline automatically" ok={outlookConnected} open={open.has('outlook')} onToggle={() => toggle('outlook')}>
            {outlookConnected ? (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div>
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  {outlookEmail && <p className="text-xs text-green-600 mt-0.5">{outlookEmail}</p>}
                </div>
                <button onClick={() => disconnect('outlook')} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">Disconnect</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Read-only access — the CRM watches your inbox for replies from leads, it doesn't send through your Outlook.
                </p>
                <Link href={`/api/integrations/outlook/connect${acctQs}`} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                  <Mail className="w-4 h-4" /> Connect Outlook
                </Link>
              </div>
            )}
          </AccordionItem>

        </div>
      </div>

    </div>
  )
}
