'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Zap, Loader2, ToggleLeft, ToggleRight,
  ChevronRight, Mail, Clock, GitBranch, X, Trash2,
} from 'lucide-react'
import { AUTOMATION_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/automation-templates'

type Automation = {
  id: string
  name: string
  description: string | null
  enabled: boolean
  trigger: string
  triggerConfig: string
  action: string
  actionConfig: string
  steps: string
  runCount: number
  lastRunAt: string | null
  createdAt: string
}

function isNewStyle(a: Automation) { return a.steps !== '{}' }

// ─── Legacy helpers ────────────────────────────────────────────────────────────

const LEGACY_TRIGGER_LABELS: Record<string, string> = {
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

function legacyTriggerDesc(a: Automation): string {
  try {
    const tc = JSON.parse(a.triggerConfig)
    if (a.trigger === 'lead_status_changed' && tc.toStatus)
      return `Lead marked as ${STATUS_LABELS[tc.toStatus] ?? tc.toStatus}`
    if (a.trigger === 'pending_quote_followup')
      return `Quote pending ${tc.days ?? 3} days`
    if (a.trigger === 'idle_deal')
      return `Idle ${tc.days ?? 7} days`
  } catch {}
  return LEGACY_TRIGGER_LABELS[a.trigger] ?? a.trigger
}

// ─── New-style step summary ────────────────────────────────────────────────────

function newStyleSummary(a: Automation): { triggerLabel: string; stepCount: number; stepTypes: string[] } {
  try {
    const def = JSON.parse(a.steps)
    const triggerMap: Record<string, string> = {
      lead_created: 'New lead', lead_status_changed: 'Status changed',
      lead_field_changed: 'Field changed', appointment_created: 'Appointment created',
      quote_created: 'Quote created', manual: 'Manual', relative_days: 'After X days',
      idle_lead: 'Lead idle', pending_quote: 'Quote unanswered',
      appointment_reminder: 'Before appointment',
    }
    const triggerLabel = triggerMap[def.trigger?.triggerType] ?? def.trigger?.triggerType ?? '—'
    const steps: { type: string }[] = def.steps ?? []
    const stepTypes = steps.map((s: { type: string }) => s.type)
    return { triggerLabel, stepCount: steps.length, stepTypes }
  } catch {
    return { triggerLabel: '—', stepCount: 0, stepTypes: [] }
  }
}

// ─── Legacy modal ──────────────────────────────────────────────────────────────

const APPT_DEFAULT_SUBJECT: Record<string, string> = {
  appointment_booked: 'Your appointment is confirmed, {{name}}!',
  appointment_reminder: 'Reminder: your appointment is tomorrow, {{name}}',
}
const APPT_DEFAULT_BODY: Record<string, string> = {
  appointment_booked: 'Hi {{name}},\n\nYour appointment has been confirmed:\n\n📅 {{date}}\n🕐 {{time}}\n📍 {{location}}\n\nIf you need to reschedule please reply to this email.',
  appointment_reminder: 'Hi {{name}},\n\nJust a reminder that you have an appointment tomorrow:\n\n📅 {{date}}\n🕐 {{time}}\n📍 {{location}}\n\nSee you soon!',
}

interface LegacyModalProps {
  initial: Automation
  onSave: (a: Automation) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function LegacyModal({ initial, onSave, onDelete, onClose }: LegacyModalProps) {
  const tc = JSON.parse(initial.triggerConfig)
  const ac = JSON.parse(initial.actionConfig)
  const [name, setName] = useState(initial.name)
  const [trigger, setTrigger] = useState(initial.trigger)
  const [toStatus, setToStatus] = useState(tc.toStatus ?? 'won')
  const [followupDays, setFollowupDays] = useState<number>(tc.days ?? (initial.trigger === 'idle_deal' ? 7 : 3))
  const [subject, setSubject] = useState(ac.subject ?? '')
  const [body, setBody] = useState(ac.body ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const lbl = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const triggerConfig =
        trigger === 'lead_status_changed' ? { toStatus } :
        trigger === 'pending_quote_followup' ? { days: followupDays } :
        trigger === 'idle_deal' ? { days: followupDays } : {}
      const res = await fetch(`/api/automations/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), trigger, triggerConfig, actionConfig: { subject, body } }),
      })
      if (res.ok) onSave(await res.json())
      else { const b = await res.json().catch(() => ({})); setError(b.error ?? `Error ${res.status}`) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${initial.name}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/automations/${initial.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(initial.id)
      else setError(`Delete failed: ${res.status}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error') }
    finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-900">Edit Automation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div>
            <label className={lbl}>Name</label>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} className={inp} />
          </div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trigger</p>
            <select value={trigger} onChange={(e) => {
              const t = e.target.value; setTrigger(t)
              if (APPT_DEFAULT_SUBJECT[t]) { setSubject(APPT_DEFAULT_SUBJECT[t]); setBody(APPT_DEFAULT_BODY[t]) }
            }} className={`${inp} bg-white`}>
              <option value="lead_created">New lead created</option>
              <option value="lead_status_changed">Lead status changes to…</option>
              <option value="pending_quote_followup">Quote pending for…</option>
              <option value="appointment_booked">Appointment booked</option>
              <option value="appointment_reminder">24h before appointment</option>
              <option value="idle_deal">Lead idle for…</option>
            </select>
            {trigger === 'lead_status_changed' && (
              <select value={toStatus} onChange={(e) => setToStatus(e.target.value)} className={`${inp} bg-white`}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            {(trigger === 'pending_quote_followup' || trigger === 'idle_deal') && (
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={365} value={followupDays}
                  onChange={(e) => setFollowupDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className={`${inp} w-24`} />
                <span className="text-sm text-slate-500">days</span>
              </div>
            )}
          </div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Action — Send Email</p>
            <div>
              <label className={lbl}>Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inp} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {VARS.slice(0, 4).map((v) => (
                  <button key={v} onClick={() => setSubject((s: string) => s + v)} className="text-xs text-indigo-600 font-mono bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded">{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Body</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={`${inp} resize-none font-mono text-xs`} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {VARS.map((v) => (
                  <button key={v} onClick={() => setBody((s: string) => s + v)} className="text-xs text-indigo-600 font-mono bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded">{v}</button>
                ))}
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={handleDelete} disabled={deleting} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Template cards ────────────────────────────────────────────────────────────

function TemplateGallery() {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900">Start from a template</h2>
        <Link href="/automations/new" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          Browse all →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AUTOMATION_TEMPLATES.slice(0, 3).map((t) => (
          <Link key={t.id} href={`/automations/new?template=${t.id}`}
            className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-4 text-left transition-all group">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{t.emoji}</span>
              <div>
                <p className="font-medium text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">{t.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Step type icons ───────────────────────────────────────────────────────────

function StepIcon({ type }: { type: string }) {
  if (type === 'action') return <Mail className="w-3 h-3" />
  if (type === 'delay') return <Clock className="w-3 h-3" />
  if (type === 'condition') return <GitBranch className="w-3 h-3" />
  return <Zap className="w-3 h-3" />
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [legacyModal, setLegacyModal] = useState<Automation | null>(null)

  const fetchAutomations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automations')
      if (res.ok) setAutomations(await res.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAutomations() }, [fetchAutomations])

  async function toggleEnabled(a: Automation) {
    const res = await fetch(`/api/automations/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    })
    if (res.ok) {
      const updated = await res.json()
      setAutomations((prev) => prev.map((x) => x.id === updated.id ? updated : x))
    }
  }

  function handleLegacySave(saved: Automation) {
    setAutomations((prev) => prev.map((a) => a.id === saved.id ? saved : a))
    setLegacyModal(null)
  }

  function handleLegacyDelete(id: string) {
    setAutomations((prev) => prev.filter((a) => a.id !== id))
    setLegacyModal(null)
  }

  const selectedCategory = 'all'
  const filteredTemplates = AUTOMATION_TEMPLATES.filter(
    (t) => selectedCategory === 'all' || t.category === selectedCategory
  )
  void filteredTemplates

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500 mt-1 text-sm">Rules that run automatically when events happen in your CRM</p>
        </div>
        <Link
          href="/automations/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Automation</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center py-16 text-center px-6">
          <Zap className="w-10 h-10 mb-3 text-slate-200" />
          <p className="font-semibold text-slate-700">No automations yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">Automate emails, team notifications, lead updates, and more</p>
          <div className="flex gap-3 mt-5">
            <Link
              href="/automations/new"
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Automation
            </Link>
          </div>
          <TemplateGallery />
        </div>
      ) : (
        <div>
          <div className="space-y-2">
            {automations.map((a) => {
              const isNew = isNewStyle(a)
              const newSummary = isNew ? newStyleSummary(a) : null

              return (
                <div key={a.id} className={`bg-white rounded-xl border transition-colors ${a.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.enabled ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                      <Zap className={`w-4 h-4 ${a.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-slate-900 text-sm truncate">{a.name}</p>
                        {!a.enabled && <span className="text-xs text-slate-400 font-medium flex-shrink-0">Disabled</span>}
                        {isNew && <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">Multi-step</span>}
                      </div>
                      {isNew && newSummary ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{newSummary.triggerLabel}</span>
                          <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <div className="flex items-center gap-1">
                            {newSummary.stepTypes.slice(0, 4).map((t, i) => <StepIcon key={i} type={t} />)}
                            <span>{newSummary.stepCount} step{newSummary.stepCount !== 1 ? 's' : ''}</span>
                          </div>
                          {a.runCount > 0 && <span className="text-slate-400">{a.runCount} run{a.runCount !== 1 ? 's' : ''}</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{legacyTriggerDesc(a)}</span>
                          <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span>Send email</span>
                          {(() => { try { const ac = JSON.parse(a.actionConfig); return ac.subject ? <span className="text-slate-400 truncate max-w-48">"{ac.subject}"</span> : null } catch { return null } })()}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => toggleEnabled(a)}
                        className={`transition-colors ${a.enabled ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-300 hover:text-slate-400'}`}
                        title={a.enabled ? 'Disable' : 'Enable'}
                      >
                        {a.enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                      </button>
                      {isNew ? (
                        <Link href={`/automations/${a.id}`}
                          className="text-xs text-slate-500 hover:text-indigo-600 font-medium border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors">
                          Edit
                        </Link>
                      ) : (
                        <button onClick={() => setLegacyModal(a)}
                          className="text-xs text-slate-500 hover:text-indigo-600 font-medium border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors">
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <TemplateGallery />
        </div>
      )}

      {legacyModal && (
        <LegacyModal
          initial={legacyModal}
          onSave={handleLegacySave}
          onDelete={handleLegacyDelete}
          onClose={() => setLegacyModal(null)}
        />
      )}
    </div>
  )
}
