'use client'
import { useState } from 'react'
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react'

interface OutboundIntegration {
  id: string
  name: string
  url: string
  authType: string
  authHeader: string | null
  authValue: string | null
  enabled: boolean
}

const AUTH_TYPES = [
  { value: 'none',    label: 'No auth' },
  { value: 'bearer',  label: 'Bearer token' },
  { value: 'api_key', label: 'API key header' },
  { value: 'basic',   label: 'Basic auth (user:pass)' },
]

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

export default function OutboundIntegrationsForm({
  initial,
}: {
  initial: OutboundIntegration[]
}) {
  const [integrations, setIntegrations] = useState<OutboundIntegration[]>(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', authType: 'none', authHeader: '', authValue: '' })
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleAdd() {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.url.trim()) { setError('URL is required'); return }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/outbound-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Failed to save')
        return
      }
      const created = await res.json()
      setIntegrations((prev) => [...prev, created])
      setForm({ name: '', url: '', authType: 'none', authHeader: '', authValue: '' })
      setAdding(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    setTogglingId(id)
    try {
      const res = await fetch(`/api/outbound-integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (res.ok) {
        const updated = await res.json()
        setIntegrations((prev) => prev.map((i) => (i.id === id ? updated : i)))
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this integration?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/outbound-integrations/${id}`, { method: 'DELETE' })
      setIntegrations((prev) => prev.filter((i) => i.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>

      {integrations.length > 0 && (
        <div className="space-y-2 mb-4">
          {integrations.map((intg) => (
            <div key={intg.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{intg.name}</p>
                <p className="text-xs text-slate-400 font-mono truncate">{intg.url}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auth: {AUTH_TYPES.find((a) => a.value === intg.authType)?.label ?? intg.authType}
                  {intg.authHeader ? ` · Header: ${intg.authHeader}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleToggle(intg.id, !intg.enabled)}
                disabled={togglingId === intg.id}
                title={intg.enabled ? 'Disable' : 'Enable'}
                className={`flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
                  intg.enabled ? 'bg-indigo-500' : 'bg-slate-300'
                } relative focus:outline-none`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  intg.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
              <button
                onClick={() => handleDelete(intg.id)}
                disabled={deletingId === intg.id}
                className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors p-1"
                title="Remove"
              >
                {deletingId === intg.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add integration
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Saved
            </span>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-slate-700">New integration</p>
            <button onClick={() => { setAdding(false); setError(null) }} className="text-slate-400 hover:text-slate-600">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="ServiceM8"
              />
            </div>
            <div>
              <label className={labelCls}>Webhook URL</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className={inputCls}
                placeholder="https://api.example.com/leads"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Auth type</label>
            <select
              value={form.authType}
              onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value }))}
              className={inputCls}
            >
              {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {form.authType !== 'none' && (
            <div className="grid grid-cols-2 gap-3">
              {form.authType === 'api_key' && (
                <div>
                  <label className={labelCls}>Header name</label>
                  <input
                    type="text"
                    value={form.authHeader}
                    onChange={(e) => setForm((f) => ({ ...f, authHeader: e.target.value }))}
                    className={inputCls}
                    placeholder="X-Api-Key"
                  />
                </div>
              )}
              <div className={form.authType === 'api_key' ? '' : 'col-span-2'}>
                <label className={labelCls}>
                  {form.authType === 'bearer' ? 'Token' : form.authType === 'basic' ? 'user:password' : 'Value'}
                </label>
                <input
                  type="password"
                  value={form.authValue}
                  onChange={(e) => setForm((f) => ({ ...f, authValue: e.target.value }))}
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setAdding(false); setError(null) }}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Plus className="w-4 h-4" /> Add</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
