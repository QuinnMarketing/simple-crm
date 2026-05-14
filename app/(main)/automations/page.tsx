'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Zap, X, Loader2, Trash2, ChevronRight, ToggleLeft, ToggleRight, Mail } from 'lucide-react'

type Automation = {
  id: string
  name: string
  enabled: boolean
  trigger: string
  triggerConfig: string
  action: string
  actionConfig: string
  createdAt: string
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'New lead created',
  lead_status_changed: 'Lead status changed',
  pending_quote_followup: 'Pending quote follow-up',
  appointment_booked: 'Appointment booked',
  appointment_reminder: '24h appointment reminder',
  idle_deal: 'Idle deal alert',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', won: 'Won', lost: 'Lost',
}

const VARS = ['{{name}}', '{{email}}', '{{phone}}', '{{service}}', '{{source}}', '{{status}}', '{{days}}', '{{title}}', '{{date}}', '{{time}}', '{{location}}']

function triggerDescription(automation: Automation): string {
  const tc = JSON.parse(automation.triggerConfig)
  if (automation.trigger === 'lead_status_changed' && tc.toStatus) {
    return `Lead marked as ${STATUS_LABELS[tc.toStatus] ?? tc.toStatus}`
  }
  if (automation.trigger === 'pending_quote_followup') {
    return `Quote pending for ${tc.days ?? 3} day${(tc.days ?? 3) !== 1 ? 's' : ''}`
  }
  if (automation.trigger === 'idle_deal') {
    return `No activity for ${tc.days ?? 7} day${(tc.days ?? 7) !== 1 ? 's' : ''}`
  }
  return TRIGGER_LABELS[automation.trigger] ?? automation.trigger
}

const APPOINTMENT_DEFAULT_SUBJECT: Record<string, string> = {
  appointment_booked: 'Your appointment is confirmed, {{name}}!',
  appointment_reminder: 'Reminder: your appointment is tomorrow, {{name}}',
}
const APPOINTMENT_DEFAULT_BODY: Record<string, string> = {
  appointment_booked: 'Hi {{name}},\n\nYour appointment has been confirmed:\n\n📅 {{date}}\n🕐 {{time}}\n📍 {{location}}\n\nIf you need to reschedule please reply to this email.\n\nLooking forward to seeing you!',
  appointment_reminder: 'Hi {{name}},\n\nJust a reminder that you have an appointment tomorrow:\n\n📅 {{date}}\n🕐 {{time}}\n📍 {{location}}\n\nIf you need to reschedule please reply to this email.\n\nSee you soon!',
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: Automation | null
  onSave: (a: Automation) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function AutomationModal({ initial, onSave, onDelete, onClose }: ModalProps) {
  const isEdit = !!initial
  const initTc = initial ? JSON.parse(initial.triggerConfig) : {}
  const initAc = initial ? JSON.parse(initial.actionConfig) : {}

  const [name, setName] = useState(initial?.name ?? '')
  const [trigger, setTrigger] = useState(initial?.trigger ?? 'lead_created')
  const [toStatus, setToStatus] = useState(initTc.toStatus ?? 'won')
  const [followupDays, setFollowupDays] = useState<number>(initTc.days ?? (initial?.trigger === 'idle_deal' ? 7 : 3))
  const defaultSubject = APPOINTMENT_DEFAULT_SUBJECT[initial?.trigger ?? trigger]
    ?? (initial?.trigger === 'pending_quote_followup' ? 'Following up on your quote, {{name}}' : 'Thanks for your enquiry, {{name}}!')
  const defaultBody = APPOINTMENT_DEFAULT_BODY[initial?.trigger ?? trigger]
    ?? (initial?.trigger === 'pending_quote_followup'
      ? 'Hi {{name}},\n\nI just wanted to follow up on the quote we sent you{{service ? " for " + service : ""}}. Please let us know if you have any questions or if you\'d like to proceed.\n\nBest regards'
      : 'Hi {{name}},\n\nThank you for reaching out. We\'ve received your enquiry{{service ? " about " + service : ""}} and will be in touch shortly.\n\nBest regards')

  const [subject, setSubject] = useState(initAc.subject ?? defaultSubject)
  const [body, setBody] = useState(initAc.body ?? defaultBody)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const triggerConfig =
        trigger === 'lead_status_changed' ? { toStatus } :
        trigger === 'pending_quote_followup' ? { days: followupDays } :
        trigger === 'idle_deal' ? { days: followupDays } :
        {}
      const actionConfig = { subject: subject.trim(), body: body.trim() }
      const payload = { name: name.trim(), trigger, triggerConfig, action: 'send_email', actionConfig }
      const res = await fetch(
        isEdit ? `/api/automations/${initial!.id}` : '/api/automations',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      if (res.ok) onSave(await res.json())
      else { const b = await res.json().catch(() => ({})); setError(b.error ?? `Error ${res.status}`) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initial || !confirm(`Delete "${initial.name}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/automations/${initial.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(initial.id)
      else setError(`Delete failed: ${res.status}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDeleting(false)
    }
  }

  function insertVar(v: string, field: 'subject' | 'body') {
    if (field === 'subject') setSubject((s: string) => s + v)
    else setBody((s: string) => s + v)
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-900">{isEdit ? 'Edit Automation' : 'New Automation'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className={labelCls}>Automation Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead confirmation email"
              className={inputCls}
            />
          </div>

          {/* Trigger */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trigger</p>
            <div>
              <label className={labelCls}>When…</label>
              <select value={trigger} onChange={(e) => {
                const t = e.target.value
                setTrigger(t)
                if (APPOINTMENT_DEFAULT_SUBJECT[t]) { setSubject(APPOINTMENT_DEFAULT_SUBJECT[t]); setBody(APPOINTMENT_DEFAULT_BODY[t]) }
              }} className={`${inputCls} bg-white`}>
                <option value="lead_created">A new lead is created</option>
                <option value="lead_status_changed">A lead's status changes to…</option>
                <option value="pending_quote_followup">A sent quote has had no response for…</option>
                <option value="appointment_booked">An appointment is booked</option>
                <option value="appointment_reminder">24 hours before an appointment</option>
                <option value="idle_deal">A lead has had no activity for…</option>
              </select>
            </div>
            {trigger === 'lead_status_changed' && (
              <div>
                <label className={labelCls}>Status</label>
                <select value={toStatus} onChange={(e) => setToStatus(e.target.value)} className={`${inputCls} bg-white`}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
            {(trigger === 'pending_quote_followup' || trigger === 'idle_deal') && (
              <div>
                <label className={labelCls}>{trigger === 'idle_deal' ? 'Days without any update' : 'Days since last contact'}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={followupDays}
                    onChange={(e) => setFollowupDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className={`${inputCls} w-24`}
                  />
                  <span className="text-sm text-slate-500">days</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {trigger === 'idle_deal'
                    ? 'Fires once per lead when their status hasn\'t changed and they haven\'t been edited for this many days. Skips Won and Lost leads.'
                    : 'Fires once per lead when their sent quote hasn\'t been accepted or declined after this many days.'}
                  {' '}Runs via <code className="bg-slate-100 px-1 rounded">/api/cron/automations</code>.
                </p>
              </div>
            )}
          </div>

          {/* Action */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</p>
              <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                <Mail className="w-3 h-3" /> Send Email to Lead
              </span>
            </div>

            <div>
              <label className={labelCls}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputCls}
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {VARS.slice(0, 4).map((v) => (
                  <button key={v} onClick={() => insertVar(v, 'subject')} className="text-xs text-indigo-600 hover:text-indigo-700 font-mono bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Message Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className={`${inputCls} resize-none font-mono text-xs`}
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {VARS.map((v) => (
                  <button key={v} onClick={() => insertVar(v, 'body')} className="text-xs text-indigo-600 hover:text-indigo-700 font-mono bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Requires SMTP email configured in <a href="/settings" className="text-indigo-600 hover:underline">Settings → Integrations</a>.
              Email is sent to the lead linked to the appointment.
              {trigger === 'appointment_reminder' && <> Reminder runs hourly via <code className="bg-slate-100 px-1 rounded">/api/cron/automations</code>.</>}
            </p>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          {isEdit ? (
            <button onClick={handleDelete} disabled={deleting} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; automation: Automation | null }>({ open: false, automation: null })

  const fetchAutomations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automations')
      if (res.ok) setAutomations(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAutomations() }, [fetchAutomations])

  async function toggleEnabled(automation: Automation) {
    const res = await fetch(`/api/automations/${automation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !automation.enabled }),
    })
    if (res.ok) {
      const updated = await res.json()
      setAutomations((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    }
  }

  function handleSave(saved: Automation) {
    setAutomations((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      return idx >= 0 ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setModal({ open: false, automation: null })
  }

  function handleDelete(id: string) {
    setAutomations((prev) => prev.filter((a) => a.id !== id))
    setModal({ open: false, automation: null })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500 mt-1 text-sm">Rules that run automatically when events happen in your CRM</p>
        </div>
        <button
          onClick={() => setModal({ open: true, automation: null })}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Automation</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center py-20 text-slate-400">
          <Zap className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No automations yet</p>
          <p className="text-sm mt-1">Create one to start sending automatic emails when leads come in</p>
          <button
            onClick={() => setModal({ open: true, automation: null })}
            className="mt-5 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Automation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => {
            const ac = JSON.parse(a.actionConfig)
            return (
              <div key={a.id} className={`bg-white rounded-xl border transition-colors ${a.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.enabled ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                    <Zap className={`w-4 h-4 ${a.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-slate-900 text-sm">{a.name}</p>
                      {!a.enabled && <span className="text-xs text-slate-400 font-medium">Disabled</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {triggerDescription(a)}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                      <Mail className="w-3 h-3" />
                      <span>Send email</span>
                      {ac.subject && <span className="text-slate-400 truncate max-w-48">"{ac.subject}"</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => toggleEnabled(a)}
                      className={`transition-colors ${a.enabled ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-300 hover:text-slate-400'}`}
                      title={a.enabled ? 'Disable' : 'Enable'}
                    >
                      {a.enabled
                        ? <ToggleRight className="w-7 h-7" />
                        : <ToggleLeft className="w-7 h-7" />}
                    </button>
                    <button
                      onClick={() => setModal({ open: true, automation: a })}
                      className="text-xs text-slate-500 hover:text-indigo-600 font-medium border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && (
        <AutomationModal
          initial={modal.automation}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal({ open: false, automation: null })}
        />
      )}
    </div>
  )
}
