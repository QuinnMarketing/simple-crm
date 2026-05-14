'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Trash2, ZoomIn, ZoomOut, Calendar, Loader2, X, Edit2, GanttChartSquare, LayoutTemplate,
} from 'lucide-react'
import { GANTT_TEMPLATES, buildTasksFromTemplate, type ProjectTemplate } from '@/lib/gantt-templates'

// ── Types ──────────────────────────────────────────────────────────────────────

interface GanttTask {
  id: string
  projectId: string
  name: string
  startDate: string
  endDate: string
  assignee: string | null
  status: string
  progress: number
  notes: string | null
}

interface GanttProject {
  id: string
  name: string
  description: string | null
  color: string
  tasks: GanttTask[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  not_started: { label: 'Not started', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
  in_progress:  { label: 'In progress', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  completed:    { label: 'Completed',   color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  on_hold:      { label: 'On hold',     color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  blocked:      { label: 'Blocked',     color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
}

const ZOOM_LEVELS = [10, 18, 28, 42]
const PROJECT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0891b2']
const TASK_COL_W = 268
const HEADER_H = 52
const ROW_H = 44
const BAR_PAD = 7

// ── Date helpers ───────────────────────────────────────────────────────────────

function today(): string { return new Date().toISOString().slice(0, 10) }

function addDays(s: string, n: number): string {
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function daysDiff(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

function isWeekend(s: string): boolean {
  const d = new Date(s + 'T00:00:00').getDay()
  return d === 0 || d === 6
}

function isMonday(s: string): boolean {
  return new Date(s + 'T00:00:00').getDay() === 1
}

function dayNum(s: string): string { return String(new Date(s + 'T00:00:00').getDate()) }

function fmtMonthYear(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
}

function fmtShort(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// ── Task Slide-Over ────────────────────────────────────────────────────────────

function TaskSlideOver({
  task, projectId, onSave, onDelete, onClose,
}: {
  task: Partial<GanttTask> | null
  projectId: string
  onSave: (d: Partial<GanttTask>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onClose: () => void
}) {
  const isNew = !task?.id
  const [name, setName] = useState(task?.name ?? '')
  const [startDate, setStartDate] = useState(task?.startDate ?? today())
  const [endDate, setEndDate] = useState(task?.endDate ?? addDays(today(), 6))
  const [assignee, setAssignee] = useState(task?.assignee ?? '')
  const [status, setStatus] = useState(task?.status ?? 'not_started')
  const [progress, setProgress] = useState(task?.progress ?? 0)
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (endDate < startDate) { setError('End date must be on or after start date'); return }
    setSaving(true); setError(null)
    try {
      await onSave({ id: task?.id, projectId, name: name.trim(), startDate, endDate, assignee: assignee.trim() || null, status, progress, notes: notes.trim() || null })
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!task?.id || !onDelete) return
    if (!confirm('Delete this task?')) return
    setDeleting(true)
    await onDelete(task.id)
    onClose()
  }

  const duration = endDate >= startDate ? daysDiff(startDate, endDate) + 1 : 0

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{isNew ? 'New Task' : 'Edit Task'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Task Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Design mockups" autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">End Date</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {duration > 0 && (
            <p className="text-xs text-slate-400 -mt-2">{duration} day{duration !== 1 ? 's' : ''}</p>
          )}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Assignee</label>
            <input type="text" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Person's name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Progress — {progress}%</label>
            <input type="range" min={0} max={100} step={5} value={progress} onChange={e => setProgress(Number(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>0%</span><span>50%</span><span>100%</span></div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional notes…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-2">
          {!isNew && onDelete ? (
            <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50 flex items-center gap-1">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isNew ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Project Modal ──────────────────────────────────────────────────────────────

function ProjectModal({ project, onSave, onClose }: {
  project?: GanttProject
  onSave: (d: { name: string; description: string; color: string }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError(null)
    try { await onSave({ name: name.trim(), description: description.trim(), color }); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-slate-900 text-lg mb-5">{project ? 'Edit Project' : 'New Project'}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Project Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign" autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Template Modal ─────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Operations', 'Construction', 'Marketing', 'Business', 'Events', 'Technology', 'Real Estate', 'HR']

function TemplateModal({ onUse, onClose }: {
  onUse: (template: ProjectTemplate, name: string, startDate: string) => Promise<void>
  onClose: () => void
}) {
  const [selected, setSelected] = useState<ProjectTemplate | null>(null)
  const [projectName, setProjectName] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pickTemplate(t: ProjectTemplate) {
    setSelected(t)
    setProjectName(t.name)
    setError(null)
  }

  async function handleCreate() {
    if (!selected) return
    if (!projectName.trim()) { setError('Project name is required'); return }
    setSaving(true); setError(null)
    try {
      await onUse(selected, projectName.trim(), startDate)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project')
    } finally { setSaving(false) }
  }

  const categories = CATEGORY_ORDER.filter(c => GANTT_TEMPLATES.some(t => t.category === c))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Project Templates</h3>
            <p className="text-xs text-slate-400 mt-0.5">Pick a template and we'll create the project with all tasks pre-filled</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Template grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {categories.map(cat => (
              <div key={cat} className="mb-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{cat}</p>
                <div className="grid grid-cols-2 gap-2">
                  {GANTT_TEMPLATES.filter(t => t.category === cat).map(t => (
                    <button
                      key={t.id}
                      onClick={() => pickTemplate(t)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        selected?.id === t.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-2xl leading-none flex-shrink-0">{t.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{t.description}</p>
                          <p className="text-xs text-slate-400 mt-1.5 font-medium">{t.tasks.length} tasks · {t.totalWeeks}w</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Config panel */}
          {selected && (
            <div className="w-64 flex-shrink-0 border-l border-slate-100 p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{selected.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{selected.name}</p>
                    <p className="text-xs text-slate-400">{selected.totalWeeks} week{selected.totalWeeks !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="space-y-1 bg-slate-50 rounded-lg p-3">
                  {selected.tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
                      <span className="text-xs text-slate-600 truncate">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Project Name</label>
                <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              <button onClick={handleCreate} disabled={saving}
                className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-auto">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Gantt Chart ────────────────────────────────────────────────────────────────

function GanttChart({ tasks, colWidth, onTaskClick }: {
  tasks: GanttTask[]
  colWidth: number
  onTaskClick: (t: GanttTask) => void
}) {
  const todayStr = today()

  // View window
  let viewStart: string, viewEnd: string
  if (tasks.length === 0) {
    viewStart = addDays(todayStr, -3)
    viewEnd = addDays(todayStr, 30)
  } else {
    const minStart = tasks.reduce((m, t) => t.startDate < m ? t.startDate : m, tasks[0].startDate)
    const maxEnd = tasks.reduce((m, t) => t.endDate > m ? t.endDate : m, tasks[0].endDate)
    viewStart = addDays(minStart, -4)
    viewEnd = addDays(maxEnd, 4)
  }

  const totalDays = daysDiff(viewStart, viewEnd) + 1
  const days: string[] = Array.from({ length: totalDays }, (_, i) => addDays(viewStart, i))
  const totalTimelineW = totalDays * colWidth
  const todayOffset = daysDiff(viewStart, todayStr) * colWidth

  // Month groups for header row 1
  const monthGroups: { label: string; idx: number; count: number }[] = []
  days.forEach((d, i) => {
    const label = fmtMonthYear(d)
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.label === label) last.count++
    else monthGroups.push({ label, idx: i, count: 1 })
  })

  return (
    <div className="overflow-auto h-full">
      <div style={{ minWidth: TASK_COL_W + totalTimelineW, minHeight: HEADER_H + tasks.length * ROW_H }}>

        {/* ── Column header ── */}
        <div className="flex sticky top-0 z-20 bg-slate-50 border-b border-slate-200" style={{ height: HEADER_H }}>
          {/* Task label */}
          <div className="sticky left-0 z-30 bg-slate-50 border-r border-slate-200 flex items-end px-4 pb-2 flex-shrink-0"
            style={{ width: TASK_COL_W, height: HEADER_H }}>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Task</span>
          </div>

          {/* Timeline header */}
          <div className="relative flex-shrink-0" style={{ width: totalTimelineW, height: HEADER_H }}>
            {/* Month row */}
            {monthGroups.map(g => (
              <div key={g.label + g.idx}
                className="absolute top-0 flex items-center px-2 border-r border-slate-200 overflow-hidden"
                style={{ left: g.idx * colWidth, width: g.count * colWidth, height: 20 }}>
                <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{g.label}</span>
              </div>
            ))}
            {/* Day row */}
            {days.map((d, i) => {
              const isToday = d === todayStr
              const weekend = isWeekend(d)
              const showLabel = colWidth >= 18 ? true : isMonday(d)
              return (
                <div key={d}
                  className={`absolute bottom-0 flex items-center justify-center border-r text-xs ${
                    isToday ? 'font-bold text-indigo-600 bg-indigo-50' :
                    weekend ? 'text-slate-400 bg-slate-100 border-slate-200' :
                    'text-slate-500 bg-slate-50 border-slate-100'
                  }`}
                  style={{ left: i * colWidth, width: colWidth, height: 32 }}>
                  {showLabel ? dayNum(d) : ''}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Rows ── */}
        {tasks.length === 0 ? (
          <div className="flex">
            <div className="sticky left-0 bg-white flex-shrink-0" style={{ width: TASK_COL_W }} />
            <div className="flex items-center justify-center text-slate-300 py-20" style={{ width: totalTimelineW }}>
              <div className="text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm text-slate-400">No tasks yet — click Add Task</p>
              </div>
            </div>
          </div>
        ) : tasks.map(task => {
          const meta = STATUS_META[task.status] ?? STATUS_META.not_started
          const startOff = Math.max(0, daysDiff(viewStart, task.startDate)) * colWidth
          const barDays = Math.max(1, daysDiff(task.startDate, task.endDate) + 1)
          const barW = barDays * colWidth - 2
          const progressW = (task.progress / 100) * barW

          return (
            <div key={task.id} className="flex border-b border-slate-100 hover:bg-indigo-50/20 group cursor-pointer"
              style={{ height: ROW_H }} onClick={() => onTaskClick(task)}>

              {/* Task info */}
              <div className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/20 border-r border-slate-100 flex items-center gap-2.5 px-4 flex-shrink-0"
                style={{ width: TASK_COL_W }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{task.name}</p>
                  {task.assignee && <p className="text-xs text-slate-400 truncate">{task.assignee}</p>}
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 hidden sm:block"
                  style={{ backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                  {meta.label.replace(' ', ' ').split(' ')[0]}
                </span>
              </div>

              {/* Timeline bar */}
              <div className="relative flex-shrink-0 flex items-center" style={{ width: totalTimelineW }}>
                {/* Weekend shading */}
                {days.map((d, i) => isWeekend(d) && (
                  <div key={d} className="absolute top-0 bottom-0 bg-slate-50/70" style={{ left: i * colWidth, width: colWidth }} />
                ))}

                {/* Today line */}
                {todayOffset >= 0 && todayOffset <= totalTimelineW && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/60 z-10" style={{ left: todayOffset }} />
                )}

                {/* Bar */}
                <div className="absolute rounded-md overflow-hidden shadow-sm"
                  style={{ left: startOff, width: barW, top: BAR_PAD, bottom: BAR_PAD, backgroundColor: meta.color, opacity: task.status === 'completed' ? 0.7 : 0.85 }}>
                  {/* Progress stripe */}
                  {task.progress > 0 && task.progress < 100 && (
                    <div className="absolute top-0 left-0 bottom-0 bg-white/25 rounded-l-md" style={{ width: progressW }} />
                  )}
                  {/* Label */}
                  {barW > 55 && (
                    <span className="absolute inset-0 flex items-center px-2 text-white text-xs font-medium truncate select-none">
                      {task.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Legend */}
        {tasks.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-100 sticky left-0">
            {Object.entries(STATUS_META).map(([k, v]) => (
              tasks.some(t => t.status === k) && (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: v.color }} />
                  <span className="text-xs text-slate-500">{v.label}</span>
                </div>
              )
            ))}
            <span className="text-xs text-slate-400 ml-auto">Click any task to edit</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GanttPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined

  const [projects, setProjects] = useState<GanttProject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [colWidth, setColWidth] = useState(28)
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: GanttProject }>({ open: false })
  const [templateOpen, setTemplateOpen] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)

  const qs = accountParam ? `?account=${accountParam}` : ''
  const selectedProject = projects.find(p => p.id === selectedId) ?? null
  const tasks = selectedProject ? [...selectedProject.tasks].sort((a, b) => a.startDate.localeCompare(b.startDate)) : []

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/gantt/projects${qs}`)
    if (res.ok) {
      const data: GanttProject[] = await res.json()
      setProjects(data)
      setSelectedId(prev => prev ?? data[0]?.id ?? null)
    }
    setLoading(false)
  }, [qs])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  async function handleCreateProject(data: { name: string; description: string; color: string }) {
    const res = await fetch(`/api/gantt/projects${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) throw new Error('Failed to create')
    const p: GanttProject = await res.json()
    setProjects(prev => [p, ...prev])
    setSelectedId(p.id)
  }

  async function handleUpdateProject(data: { name: string; description: string; color: string }) {
    if (!selectedProject) return
    const res = await fetch(`/api/gantt/projects/${selectedProject.id}${qs}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) throw new Error('Failed to update')
    const updated = await res.json()
    setProjects(prev => prev.map(p => p.id === updated.id ? { ...updated, tasks: p.tasks } : p))
  }

  async function handleDeleteProject() {
    if (!selectedProject || !confirm(`Delete "${selectedProject.name}" and all its tasks?`)) return
    setDeletingProject(true)
    await fetch(`/api/gantt/projects/${selectedProject.id}${qs}`, { method: 'DELETE' })
    setProjects(prev => {
      const next = prev.filter(p => p.id !== selectedProject.id)
      setSelectedId(next[0]?.id ?? null)
      return next
    })
    setDeletingProject(false)
  }

  async function handleSaveTask(data: Partial<GanttTask>) {
    if (data.id) {
      const res = await fetch(`/api/gantt/tasks/${data.id}${qs}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed to update task')
      const updated: GanttTask = await res.json()
      setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, tasks: p.tasks.map(t => t.id === updated.id ? updated : t) } : p))
    } else {
      const res = await fetch(`/api/gantt/tasks${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, projectId: selectedId }) })
      if (!res.ok) throw new Error('Failed to create task')
      const created: GanttTask = await res.json()
      setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, tasks: [...p.tasks, created] } : p))
    }
  }

  async function handleCreateFromTemplate(template: ProjectTemplate, name: string, startDate: string) {
    const res = await fetch(`/api/gantt/projects${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: template.color }),
    })
    if (!res.ok) throw new Error('Failed to create project')
    const project: GanttProject = await res.json()

    const taskDefs = buildTasksFromTemplate(template, startDate)
    const created: GanttTask[] = []
    for (const td of taskDefs) {
      const tr = await fetch(`/api/gantt/tasks${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...td, projectId: project.id }),
      })
      if (tr.ok) created.push(await tr.json())
    }

    setProjects(prev => [{ ...project, tasks: created }, ...prev])
    setSelectedId(project.id)
  }

  async function handleDeleteTask(id: string) {
    await fetch(`/api/gantt/tasks/${id}${qs}`, { method: 'DELETE' })
    setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, tasks: p.tasks.filter(t => t.id !== id) } : p))
  }

  const zoomIdx = ZOOM_LEVELS.indexOf(colWidth)

  return (
    <div className="flex -m-6" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Project sidebar ── */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <button onClick={() => setProjectModal({ open: true })}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Project
          </button>
          <button onClick={() => setTemplateOpen(true)}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <LayoutTemplate className="w-3.5 h-3.5" /> From Template
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 px-3">
              <p className="text-xs text-slate-400">No projects yet</p>
            </div>
          ) : projects.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                selectedId === p.id ? 'bg-indigo-50 text-indigo-900' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="truncate font-medium flex-1">{p.name}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{p.tasks.length}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {selectedProject ? (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4 flex-shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProject.color }} />
                <h1 className="font-bold text-slate-900 truncate">{selectedProject.name}</h1>
                {selectedProject.description && (
                  <span className="text-slate-400 text-sm truncate hidden md:block">— {selectedProject.description}</span>
                )}
                <button onClick={() => setProjectModal({ open: true, project: selectedProject })} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg p-1">
                  <button onClick={() => setColWidth(ZOOM_LEVELS[Math.max(0, zoomIdx - 1)])} disabled={zoomIdx === 0}
                    className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-400 px-1 tabular-nums w-10 text-center">{colWidth}px/d</span>
                  <button onClick={() => setColWidth(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1)])} disabled={zoomIdx === ZOOM_LEVELS.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button onClick={handleDeleteProject} disabled={deletingProject}
                  className="p-2 text-slate-400 hover:text-red-500 border border-slate-200 rounded-lg transition-colors disabled:opacity-50">
                  {deletingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setNewTaskOpen(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 overflow-hidden">
              <GanttChart tasks={tasks} colWidth={colWidth} onTaskClick={setEditingTask} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <GanttChartSquare className="w-16 h-16 mb-4 opacity-40" />
            <p className="font-semibold text-slate-500 text-lg">No project selected</p>
            <p className="text-sm text-slate-400 mt-1">Create a project to get started</p>
            <button onClick={() => setProjectModal({ open: true })}
              className="mt-5 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingTask && (
        <TaskSlideOver task={editingTask} projectId={selectedId!} onSave={handleSaveTask} onDelete={handleDeleteTask} onClose={() => setEditingTask(null)} />
      )}
      {newTaskOpen && (
        <TaskSlideOver task={null} projectId={selectedId!} onSave={handleSaveTask} onClose={() => setNewTaskOpen(false)} />
      )}
      {projectModal.open && (
        <ProjectModal project={projectModal.project} onSave={projectModal.project ? handleUpdateProject : handleCreateProject} onClose={() => setProjectModal({ open: false })} />
      )}
      {templateOpen && (
        <TemplateModal onUse={handleCreateFromTemplate} onClose={() => setTemplateOpen(false)} />
      )}
    </div>
  )
}
