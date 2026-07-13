'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, Copy, Check } from 'lucide-react'

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1'

type State = {
  configured: boolean
  enabled: boolean
  secretKeyMasked: string
  publishableKey: string
  webhookSecretMasked: string
  webhookUrl: string
}

export default function StripeSettingsForm({ accountId }: { accountId: string | null }) {
  const qs = accountId ? `?account=${accountId}` : ''
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [secretKey, setSecretKey] = useState('')
  const [publishableKey, setPublishableKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/settings/stripe${qs}`)
    if (r.ok) {
      const d: State = await r.json()
      setState(d)
      setPublishableKey(d.publishableKey ?? '')
    }
    setLoading(false)
  }, [qs])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch('/api/settings/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(accountId ? { accountId } : {}),
        // Only send secrets when the user actually typed one — blanks keep the stored value.
        ...(secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
        publishableKey: publishableKey.trim(),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
      }),
    })
    if (res.ok) {
      setSaved(true)
      setSecretKey(''); setWebhookSecret('')
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Save failed')
    }
    setSaving(false)
  }

  function copyWebhook() {
    if (!state?.webhookUrl) return
    navigator.clipboard.writeText(state.webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return <div className="flex items-center py-4 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…</div>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Connect your own Stripe account to collect card payments from your customers — booking deposits and invoice &ldquo;Pay Now&rdquo; links.
        Find these keys in your Stripe Dashboard under Developers → API keys.
      </p>

      {state?.configured && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 text-green-500" /> Stripe is connected
          {state.secretKeyMasked && <span className="font-mono text-green-600">({state.secretKeyMasked})</span>}
        </div>
      )}

      <div>
        <label className={labelCls}>Secret key</label>
        <input
          className={inputCls}
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={state?.secretKeyMasked ? `${state.secretKeyMasked} — leave blank to keep` : 'sk_live_…'}
          autoComplete="off"
        />
      </div>

      <div>
        <label className={labelCls}>Publishable key</label>
        <input
          className={inputCls}
          value={publishableKey}
          onChange={(e) => setPublishableKey(e.target.value)}
          placeholder="pk_live_…"
          autoComplete="off"
        />
      </div>

      <div>
        <label className={labelCls}>Webhook signing secret</label>
        <input
          className={inputCls}
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={state?.webhookSecretMasked ? `${state.webhookSecretMasked} — leave blank to keep` : 'whsec_…'}
          autoComplete="off"
        />
      </div>

      {state?.webhookUrl && (
        <div>
          <label className={labelCls}>Your webhook endpoint URL</label>
          <p className="text-xs text-slate-500 mb-1.5">
            In Stripe → Developers → Webhooks, add an endpoint with this URL and the event <span className="font-mono">checkout.session.completed</span>, then paste the signing secret above.
          </p>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <code className="text-xs font-mono text-slate-700 flex-1 break-all">{state.webhookUrl}</code>
            <button onClick={copyWebhook} className="text-slate-400 hover:text-indigo-600 transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Stripe settings
        </button>
        {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved</span>}
      </div>
    </div>
  )
}
