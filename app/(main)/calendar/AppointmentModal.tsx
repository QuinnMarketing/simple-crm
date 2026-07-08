'use client'
import { useState } from 'react'
import { X, Loader2, Mic, CheckCircle2 } from 'lucide-react'

export type Lead = { id: string; name: string }
export type ScheduleUser = { id: string; name: string | null; email: string }

export type Appointment = {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  allDay: boolean
  location: string | null
  leadId: string | null
  lead: Lead | null
  userId: string | null
  assignedTo: { id: string; name: string | null } | null
  googleEventId: string | null
  firefliesStatus?: string | null
  status?: string | null
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateInput(iso: string) {
  return iso.split('T')[0]
}

export function dayToDateInput(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function defaultTimeStr(date: Date, offsetHours: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  const h = hasTime ? (date.getHours() + offsetHours) % 24 : (9 + offsetHours)
  return `${dayToDateInput(date)}T${pad(h)}:${pad(date.getMinutes())}`
}

function toLocalFromDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface ModalProps {
  initial?: Appointment | null
  defaultDate?: Date
  defaultEndTime?: Date
  defaultLeadId?: string
  defaultUserId?: string
  leads: Lead[]
  users?: ScheduleUser[]
  onSave: (appt: Appointment) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

export default function AppointmentModal({ initial, defaultDate, defaultEndTime, defaultLeadId, defaultUserId, leads, users, onSave, onDelete, onClose }: ModalProps) {
  const isEdit = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [allDay, setAllDay] = useState(initial?.allDay ?? false)
  const [startTime, setStartTime] = useState(
    initial ? (initial.allDay ? toDateInput(initial.startTime) : toLocalInput(initial.startTime))
    : defaultDate ? (allDay ? dayToDateInput(defaultDate) : defaultTimeStr(defaultDate, 0)) : ''
  )
  const [endTime, setEndTime] = useState(
    initial ? (initial.allDay ? toDateInput(initial.endTime) : toLocalInput(initial.endTime))
    : defaultEndTime ? toLocalFromDate(defaultEndTime)
    : defaultDate ? (allDay ? dayToDateInput(defaultDate) : defaultTimeStr(defaultDate, 1)) : ''
  )
  const [location, setLocation] = useState(initial?.location ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'scheduled')
  const [firefliesStatus, setFirefliesStatus] = useState(initial?.firefliesStatus ?? null)
  const [firefliesLoading, setFirefliesLoading] = useState(false)
  const [firefliesError, setFirefliesError] = useState('')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [leadId, setLeadId] = useState(initial?.leadId ?? defaultLeadId ?? '')
  const [userId, setUserId] = useState(initial?.userId ?? defaultUserId ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleAllDay(val: boolean) {
    setAllDay(val)
    if (val) {
      setStartTime((s) => s.split('T')[0])
      setEndTime((e) => e.split('T')[0])
    } else {
      setStartTime((s) => `${s.split('T')[0]}T09:00`)
      setEndTime((e) => `${e.split('T')[0]}T10:00`)
    }
  }

  async function handleSave() {
    if (!title.trim() || !startTime || !endTime) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        allDay,
        startTime: allDay ? `${startTime}T00:00:00.000Z` : new Date(startTime).toISOString(),
        endTime: allDay ? `${endTime}T23:59:59.000Z` : new Date(endTime).toISOString(),
        leadId: leadId || null,
        userId: userId || null,
        ...(isEdit ? { status } : {}),
      }
      const res = await fetch(
        isEdit ? `/api/appointments/${initial!.id}` : '/api/appointments',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      if (res.ok) {
        onSave(await res.json())
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? `Server error ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initial || !confirm(`Delete "${initial.title}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/appointments/${initial.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete?.(initial.id)
      } else {
        setError(`Delete failed: ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDeleting(false)
    }
  }

  async function startRecording() {
    if (!initial) return
    setFirefliesLoading(true)
    setFirefliesError('')
    try {
      const res = await fetch(`/api/appointments/${initial.id}/fireflies`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setFirefliesStatus('requested')
      } else {
        setFirefliesError(data.error ?? 'Failed to start recording')
      }
    } catch {
      setFirefliesError('Network error')
    } finally {
      setFirefliesLoading(false)
    }
  }

  const isMeetingLink = (() => {
    try { const u = new URL(location); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
  })()

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-900">{isEdit ? 'Edit Appointment' : 'New Appointment'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title…"
              className={inputCls}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="allday"
              type="checkbox"
              checked={allDay}
              onChange={(e) => toggleAllDay(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="allday" className="text-sm text-slate-600 cursor-pointer">All day</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{allDay ? 'Start date' : 'Start'}</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{allDay ? 'End date' : 'End'}</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Office, Zoom link…"
              className={inputCls}
            />
          </div>

          {isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'no_show', label: 'No-show' },
                  { value: 'cancelled', label: 'Cancelled' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      status === value
                        ? value === 'cancelled' || value === 'no_show'
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : value === 'completed'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEdit && isMeetingLink && (
            <div>
              {firefliesStatus === 'recorded' ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Recorded — time entry logged automatically
                </p>
              ) : firefliesStatus === 'requested' ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fireflies will join at meeting time — a time entry will be logged once it's transcribed
                </p>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={firefliesLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {firefliesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                  Start Fireflies Recording
                </button>
              )}
              {firefliesError && <p className="text-xs text-red-600 mt-1">{firefliesError}</p>}
            </div>
          )}

          {users && users.length > 0 && (
            <div>
              <label className={labelCls}>Assigned to</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Link to Lead</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">— No lead —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Agenda, notes…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
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
