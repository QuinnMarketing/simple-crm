'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, Plus, Trash2, Edit2, X, Loader2, Clock, Phone, Users, Wrench, Mail, ClipboardList, MoreHorizontal, Check } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryType = 'call' | 'meeting' | 'work' | 'email' | 'admin' | 'other'

interface Lead { id: string; name: string }
interface User { id: string; name?: string | null; email: string }

interface TimeEntry {
  id: string
  type: EntryType
  description: string | null
  durationMin: number
  startedAt: string
  assignedTo: string | null
  lead: Lead | null
  user: User | null
}

const TYPE_META: Record<EntryType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  call:    { label: 'Call',         color: 'text-blue-700',   bg: 'bg-blue-100',   Icon: Phone },
  meeting: { label: 'Meeting',      color: 'text-purple-700', bg: 'bg-purple-100', Icon: Users },
  work:    { label: 'Work',         color: 'text-emerald-700',bg: 'bg-emerald-100',Icon: Wrench },
  email:   { label: 'Email',        color: 'text-amber-700',  bg: 'bg-amber-100',  Icon: Mail },
  admin:   { label: 'Admin',        color: 'text-slate-700',  bg: 'bg-slate-100',  Icon: ClipboardList },
  other:   { label: 'Other',        color: 'text-rose-700',   bg: 'bg-rose-100',   Icon: MoreHorizontal },
}

const ALL_TYPES = Object.keys(TYPE_META) as EntryType[]

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────

interface ModalProps {
  initial?: TimeEntry | null
  prefillDuration?: number
  prefillStartedAt?: string
  leads: Lead[]
  users: User[]
  currentUserId: string
  onSave: (entry: TimeEntry) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

function EntryModal({ initial, prefillDuration, prefillStartedAt, leads, users, currentUserId, onSave, onDelete, onClose }: ModalProps) {
  const isEdit = !!initial
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  const [type, setType] = useState<EntryType>(initial?.type ?? 'call')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [hours, setHours] = useState(String(Math.floor((initial?.durationMin ?? prefillDuration ?? 30) / 60)))
  const [minutes, setMinutes] = useState(String((initial?.durationMin ?? prefillDuration ?? 30) % 60))
  const [startedAt, setStartedAt] = useState(() => {
    const d = initial?.startedAt ?? prefillStartedAt ?? new Date().toISOString()
    return new Date(d).toISOString().slice(0, 16)
  })
  const [leadId, setLeadId] = useState(initial?.lead?.id ?? '')
  const defaultName = initial
    ? (initial.assignedTo ?? initial.user?.name ?? initial.user?.email ?? '')
    : (users.find((u) => u.id === currentUserId)?.name ?? users.find((u) => u.id === currentUserId)?.email ?? '')
  const [assignedTo, setAssignedTo] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalMin = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0)

  async function handleSave() {
    if (totalMin < 1) { setError('Duration must be at least 1 minute'); return }
    setSaving(true); setError(null)
    try {
      // Match typed name to a registered user if possible (for linking)
      const matchedUser = users.find((u) => (u.name ?? u.email) === assignedTo)
      const payload = {
        type, description, durationMin: totalMin,
        startedAt: new Date(startedAt).toISOString(),
        leadId: leadId || null,
        assignedTo: assignedTo.trim() || null,
        userId: matchedUser?.id || null,
      }
      const res = await fetch(
        isEdit ? `/api/time-entries/${initial!.id}` : '/api/time-entries',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      if (res.ok) onSave(await res.json())
      else { const b = await res.json().catch(() => ({})); setError(b.error ?? `Error ${res.status}`) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!initial || !confirm('Delete this time entry?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/time-entries/${initial.id}`, { method: 'DELETE' })
      if (res.ok) onDelete?.(initial.id)
      else setError(`Delete failed: ${res.status}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{isEdit ? 'Edit Entry' : 'Log Time'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type */}
          <div>
            <label className={labelCls}>Activity Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_TYPES.map((t) => {
                const meta = TYPE_META[t]
                const active = type === t
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      active ? `${meta.bg} ${meta.color} border-transparent` : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <meta.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className={labelCls}>Duration</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input type="number" min={0} max={23} value={hours} onChange={(e) => setHours(e.target.value)} className={inputCls} placeholder="0" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">hrs</span>
              </div>
              <div className="relative flex-1">
                <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputCls} placeholder="30" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">min</span>
              </div>
            </div>
          </div>

          {/* Date/time */}
          <div>
            <label className={labelCls}>Started At</label>
            <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className={inputCls} />
          </div>

          {/* Lead */}
          <div>
            <label className={labelCls}>Lead (optional)</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">— No lead —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Employee */}
          <div>
            <label className={labelCls}>Logged by</label>
            <input
              type="text"
              list="users-datalist"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Enter a name…"
              className={inputCls}
            />
            <datalist id="users-datalist">
              {users.map((u) => (
                <option key={u.id} value={u.name ?? u.email} />
              ))}
            </datalist>
            <p className="text-xs text-slate-400 mt-1">Type any name — registered users appear as suggestions</p>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What did you work on?"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          {isEdit ? (
            <button onClick={handleDelete} disabled={deleting} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save changes' : 'Log time'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TIMER_KEY = 'crm_timer_start'

export default function TimePage() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; entry?: TimeEntry | null; prefillDuration?: number; prefillStartedAt?: string }>({ open: false })
  const [filterType, setFilterType] = useState<EntryType | 'all'>('all')

  // Live timer
  const [timerStart, setTimerStart] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(TIMER_KEY)
    return stored ? parseInt(stored) : null
  })
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tick
  useEffect(() => {
    if (timerStart) {
      const tick = () => setElapsed(Math.floor((Date.now() - timerStart) / 1000))
      tick()
      intervalRef.current = setInterval(tick, 1000)
    } else {
      setElapsed(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerStart])

  function startTimer() {
    const now = Date.now()
    localStorage.setItem(TIMER_KEY, String(now))
    setTimerStart(now)
  }

  function stopTimer() {
    if (!timerStart) return
    const durationMin = Math.max(1, Math.round(elapsed / 60))
    const startedAt = new Date(timerStart).toISOString()
    localStorage.removeItem(TIMER_KEY)
    setTimerStart(null)
    setModal({ open: true, prefillDuration: durationMin, prefillStartedAt: startedAt })
  }

  function cancelTimer() {
    localStorage.removeItem(TIMER_KEY)
    setTimerStart(null)
  }

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/time-entries')
      if (res.ok) setEntries(await res.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    fetch('/api/leads?_all=1').then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setLeads(d.map((l: Lead) => ({ id: l.id, name: l.name })))
    }).catch(() => {})

    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/auth/session').then((r) => r.json()),
    ]).then(([usersData, session]) => {
      if (Array.isArray(usersData)) setUsers(usersData.map((u: User) => ({ id: u.id, name: u.name, email: u.email })))
      if (session?.user?.id) setCurrentUserId(session.user.id)
    }).catch(() => {})
  }, [])

  function handleSave(saved: TimeEntry) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id)
      return idx >= 0 ? prev.map((e) => e.id === saved.id ? saved : e) : [saved, ...prev]
    })
    setModal({ open: false })
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setModal({ open: false })
  }

  const filtered = filterType === 'all' ? entries : entries.filter((e) => e.type === filterType)

  // Summary stats
  const now = new Date()
  const todayStr = now.toDateString()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); weekStart.setHours(0,0,0,0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const sumMin = (arr: TimeEntry[]) => arr.reduce((s, e) => s + e.durationMin, 0)
  const todayMin = sumMin(entries.filter((e) => new Date(e.startedAt).toDateString() === todayStr))
  const weekMin  = sumMin(entries.filter((e) => new Date(e.startedAt) >= weekStart))
  const monthMin = sumMin(entries.filter((e) => new Date(e.startedAt) >= monthStart))

  // Group by date for the list
  const grouped: { date: string; items: TimeEntry[] }[] = []
  for (const entry of filtered) {
    const label = fmtDate(entry.startedAt)
    const last = grouped[grouped.length - 1]
    if (last?.date === label) last.items.push(entry)
    else grouped.push({ date: label, items: [entry] })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Time Tracking</h1>
          <p className="text-slate-500 mt-1 text-sm">Log calls, meetings, and work across your leads</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Log Time</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Today', value: fmtDuration(todayMin), sub: `${todayMin} minutes` },
          { label: 'This Week', value: fmtDuration(weekMin), sub: `${weekMin} minutes` },
          { label: 'This Month', value: fmtDuration(monthMin), sub: `${monthMin} minutes` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Live timer */}
      <div className={`bg-white rounded-xl border mb-6 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${timerStart ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${timerStart ? 'bg-indigo-600' : 'bg-slate-100'}`}>
            <Clock className={`w-5 h-5 ${timerStart ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div>
            {timerStart ? (
              <>
                <p className="text-2xl font-mono font-bold text-indigo-700 leading-none">{fmtElapsed(elapsed)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Timer running — click Stop to log</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-900">Live Timer</p>
                <p className="text-xs text-slate-500">Start a timer and log it automatically when you&apos;re done</p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {timerStart ? (
            <>
              <button
                onClick={cancelTimer}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={stopTimer}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Square className="w-4 h-4 fill-white" /> Stop &amp; Log
              </button>
            </>
          ) : (
            <button
              onClick={startTimer}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Play className="w-4 h-4 fill-white" /> Start Timer
            </button>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['all', ...ALL_TYPES] as const).map((t) => {
          const active = filterType === t
          if (t === 'all') return (
            <button key="all" onClick={() => setFilterType('all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              All
            </button>
          )
          const meta = TYPE_META[t]
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${active ? `${meta.bg} ${meta.color} border-transparent` : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <meta.Icon className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Entries list */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
          <Clock className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No time entries yet</p>
          <p className="text-sm mt-1">Start the timer or manually log an activity</p>
          <button
            onClick={() => setModal({ open: true })}
            className="mt-5 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Log Time
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => {
            const groupMin = sumMin(items)
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">{date}</p>
                  <p className="text-xs text-slate-400">{fmtDuration(groupMin)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
                  {items.map((entry) => {
                    const meta = TYPE_META[entry.type] ?? TYPE_META.other
                    const Icon = meta.Icon
                    return (
                      <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 group">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                            {entry.lead && (
                              <Link href={`/leads/${entry.lead.id}`} className="text-xs text-indigo-600 hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                                {entry.lead.name}
                              </Link>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-sm text-slate-700 truncate mt-0.5">{entry.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(entry.startedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            {(entry.assignedTo ?? entry.user?.name ?? entry.user?.email) && (
                              <span> · {entry.assignedTo ?? entry.user?.name ?? entry.user?.email}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-semibold text-slate-700">{fmtDuration(entry.durationMin)}</span>
                          <button
                            onClick={() => setModal({ open: true, entry })}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && (
        <EntryModal
          initial={modal.entry}
          prefillDuration={modal.prefillDuration}
          prefillStartedAt={modal.prefillStartedAt}
          leads={leads}
          users={users}
          currentUserId={currentUserId}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
