'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Save, Trash2, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Plus, CalendarDays, Navigation,
  Phone, MessageSquare,
} from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import AppointmentModal, { type Appointment } from '@/app/(main)/calendar/AppointmentModal'
import QuotesSection from './QuotesSection'
import LeadTimeline from './LeadTimeline'
import NextStepsCard from './NextStepsCard'
import TimeInStageCard from './TimeInStageCard'

type Company = { id: string; name: string; color: string }

type Lead = {
  id: string; name: string; email: string | null; phone: string | null; address: string | null
  source: string | null; status: string; service: string | null; notes: string | null
  value: number | null; formData: string | null; gclid: string | null
  fbclid: string | null; fbp: string | null; fbc: string | null
  userAgent: string | null; ipAddress: string | null; pageUrl: string | null
  nextStep: string | null; nextStepDue: string | null; lostReason: string | null
  companyId: string | null; company: Company | null
  createdAt: string; updatedAt: string
  conversions: Conversion[]
  appointments: Appointment[]
}

type Conversion = {
  id: string; platform: string; eventName: string; value: number | null
  status: string; errorMessage: string | null; sentAt: string
}

type PushState = { status: 'idle' | 'pushing' | 'success' | 'error'; message?: string }

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost']
const SOURCES = ['website', 'referral', 'google_ads', 'facebook_ads', 'cold_outreach', 'webhook', 'other']

const PLATFORM_LABELS: Record<string, string> = {
  google_ga4: 'Google Analytics 4',
  google_ads: 'Google Ads',
  facebook: 'Facebook / Meta',
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [form, setForm] = useState<Partial<Lead>>({})
  const [companies, setCompanies] = useState<Company[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [apptModal, setApptModal] = useState<{ open: boolean; appt?: Appointment | null }>({ open: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showAttribution, setShowAttribution] = useState(false)
  const [showFormData, setShowFormData] = useState(false)
  const [pushState, setPushState] = useState<Record<string, PushState>>({
    google_ga4: { status: 'idle' },
    google_ads: { status: 'idle' },
    facebook: { status: 'idle' },
  })

  const fetchLead = useCallback(async () => {
    const res = await fetch(`/api/leads/${id}`)
    if (res.ok) {
      const data = await res.json()
      setLead(data)
      setForm(data)
      setAppointments(data.appointments ?? [])
      setDirty(false)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchLead() }, [fetchLead])

  useEffect(() => {
    fetch('/api/companies').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCompanies(d) })
  }, [])

  function setField(field: keyof Lead, value: string | number | null) {
    setForm((f) => ({ ...f, [field]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead(updated)
      setForm(updated)
      setDirty(false)
    }
    setSaving(false)
  }

  async function pushTo(platform: string) {
    setPushState((s) => ({ ...s, [platform]: { status: 'pushing' } }))
    const res = await fetch(`/api/leads/${id}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    })
    const result = await res.json()
    setPushState((s) => ({
      ...s,
      [platform]: { status: result.success ? 'success' : 'error', message: result.error },
    }))
    await fetchLead()
  }

  async function deleteLead() {
    if (!confirm(`Delete "${lead?.name}"? This cannot be undone.`)) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }
  if (!lead) return <div className="text-slate-500">Lead not found.</div>

  const lastPushed = (platform: string) =>
    lead.conversions.filter((c) => c.platform === platform).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]

  return (
    <div>
      <div className="mb-6">
        <Link href="/leads" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{lead.name}</h1>
            <StatusBadge status={lead.status} />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save Changes'}</span>
              </button>
            )}
            <button
              onClick={deleteLead}
              className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-red-200"
            >
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          Added {new Date(lead.createdAt).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {lead.updatedAt !== lead.createdAt && (
            <span className="text-slate-400"> · Last edited {new Date(lead.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead Info */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Lead Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => setField('name', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => setField('email', e.target.value || null)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Phone</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={form.phone ?? ''}
                    onChange={(e) => setField('phone', e.target.value || null)}
                    className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {form.phone && (
                    <div className="flex gap-1">
                      <a href={`tel:${form.phone}`} title="Call"
                        className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors">
                        <Phone className="w-4 h-4" />
                      </a>
                      <a href={`sms:${form.phone}`} title="SMS"
                        className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                        <MessageSquare className="w-4 h-4" />
                      </a>
                      <a href={`https://wa.me/${form.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                        className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors text-xs font-bold">
                        WA
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Address</label>
                <input
                  type="text"
                  value={form.address ?? ''}
                  onChange={(e) => setField('address', e.target.value || null)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="123 Example St, Sydney NSW 2000"
                />
              </div>

              {lead.address && (
                <div className="col-span-2">
                  <div className="rounded-lg overflow-hidden border border-slate-200 relative">
                    <iframe
                      title="Lead address map"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(lead.address)}&output=embed&zoom=15`}
                      className="w-full h-44"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white text-slate-800 text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                      Navigate
                    </a>
                  </div>
                </div>
              )}

              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Company</label>
                <select
                  value={form.companyId ?? ''}
                  onChange={(e) => setField('companyId', e.target.value || null)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="">— No company —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Service</label>
                <input
                  type="text"
                  value={form.service ?? ''}
                  onChange={(e) => setField('service', e.target.value || null)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Estimated Value (AUD)</label>
                <input
                  type="number"
                  value={form.value ?? ''}
                  onChange={(e) => setField('value', e.target.value ? parseFloat(e.target.value) : null)}
                  min="0" step="100"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Status</label>
                <select
                  value={form.status ?? 'new'}
                  onChange={(e) => setField('status', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white capitalize"
                >
                  {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Source</label>
                <select
                  value={form.source ?? ''}
                  onChange={(e) => setField('source', e.target.value || null)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="">— Select —</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {form.status === 'lost' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Lost Reason</label>
                  <input
                    type="text"
                    value={form.lostReason ?? ''}
                    onChange={(e) => setField('lostReason', e.target.value || null)}
                    placeholder="e.g. Price too high, went with competitor, no budget…"
                    className="w-full px-3 py-2.5 border border-red-200 bg-red-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent placeholder:text-slate-400"
                  />
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Notes</label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={(e) => setField('notes', e.target.value || null)}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Call notes, requirements, next steps…"
                />
              </div>
            </div>
          </div>

          <QuotesSection
            leadId={id}
            onValueChange={(value) => {
              setForm((f) => ({ ...f, value }))
              setLead((l) => l ? { ...l, value } : l)
              setDirty(true)
            }}
          />

          {/* Attribution */}
          <div className="bg-white rounded-xl border border-slate-200">
            <button
              onClick={() => setShowAttribution(!showAttribution)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <span className="font-semibold text-slate-900 text-sm">Attribution Data</span>
              {showAttribution ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showAttribution && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                {[
                  ['gclid', lead.gclid], ['fbclid', lead.fbclid], ['fbp', lead.fbp],
                  ['fbc', lead.fbc], ['Page URL', lead.pageUrl], ['IP Address', lead.ipAddress],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="text-sm text-slate-700 mt-0.5 break-all font-mono">{value ?? <span className="text-slate-400 font-sans">—</span>}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw form data */}
          {lead.formData && (
            <div className="bg-white rounded-xl border border-slate-200">
              <button
                onClick={() => setShowFormData(!showFormData)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-semibold text-slate-900 text-sm">Raw Form Data</span>
                {showFormData ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showFormData && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                  <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(lead.formData), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Next Steps + Appointments + Platform Push */}
        <div className="space-y-5">
          <NextStepsCard
            leadId={id}
            status={lead.status}
            initialNextStep={lead.nextStep}
            initialNextStepDue={lead.nextStepDue}
          />

          {/* Appointments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Appointments</h2>
              <button
                onClick={() => setApptModal({ open: true, appt: null })}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule
              </button>
            </div>
            {appointments.length === 0 ? (
              <div className="text-center py-5 text-slate-400">
                <CalendarDays className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No appointments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {appointments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setApptModal({ open: true, appt: a })}
                    className="w-full text-left border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.allDay
                        ? new Date(a.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                        : new Date(a.startTime).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                    {a.location && <p className="text-xs text-slate-400 mt-0.5 truncate">{a.location}</p>}
                    {a.googleEventId && <p className="text-xs text-green-600 mt-1 font-medium">Synced to Google Calendar</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <TimeInStageCard leadId={id} />
          <LeadTimeline leadId={id} />

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Push to Platforms</h2>
            <div className="space-y-3">
              {(['google_ga4', 'google_ads', 'facebook'] as const).map((platform) => {
                const last = lastPushed(platform)
                const state = pushState[platform]
                const isGoogleAds = platform === 'google_ads'
                const noGclid = isGoogleAds && !lead.gclid

                return (
                  <div key={platform} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{PLATFORM_LABELS[platform]}</p>
                        {last && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Last pushed {new Date(last.sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                        {noGclid && (
                          <p className="text-xs text-amber-600 mt-0.5">Requires gclid (Google Ads click)</p>
                        )}
                      </div>
                      {last?.status === 'sent' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    </div>

                    <button
                      onClick={() => pushTo(platform)}
                      disabled={state.status === 'pushing' || noGclid}
                      className={`w-full py-2 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                        noGclid
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : state.status === 'success'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : state.status === 'error'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {state.status === 'pushing' ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Pushing…</>
                      ) : state.status === 'success' ? (
                        <><CheckCircle className="w-3 h-3" /> Sent!</>
                      ) : state.status === 'error' ? (
                        <><XCircle className="w-3 h-3" /> Failed — Retry</>
                      ) : (
                        last ? `Push Again` : `Push to ${platform === 'google_ga4' ? 'GA4' : platform === 'google_ads' ? 'Google Ads' : 'Facebook'}`
                      )}
                    </button>

                    {state.status === 'error' && state.message && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {state.message}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Conversion History */}
          {lead.conversions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Conversion History</h2>
              <div className="space-y-2">
                {lead.conversions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{PLATFORM_LABELS[c.platform] ?? c.platform}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(c.sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {apptModal.open && lead && (
        <AppointmentModal
          initial={apptModal.appt}
          defaultLeadId={lead.id}
          leads={[{ id: lead.id, name: lead.name }]}
          onSave={(appt) => {
            setAppointments((prev) => {
              const idx = prev.findIndex((a) => a.id === appt.id)
              return idx >= 0 ? prev.map((a) => a.id === appt.id ? appt : a) : [...prev, appt]
            })
            setApptModal({ open: false })
          }}
          onDelete={(apptId) => {
            setAppointments((prev) => prev.filter((a) => a.id !== apptId))
            setApptModal({ open: false })
          }}
          onClose={() => setApptModal({ open: false })}
        />
      )}
    </div>
  )
}
