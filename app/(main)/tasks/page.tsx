'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { CheckSquare, Plus, Zap, Circle, CheckCircle2, Loader2, Trash2, ExternalLink } from 'lucide-react'

type LeadRef = { id: string; name: string }

type Task = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  leadId: string | null
  lead: LeadRef | null
  createdAt: string
  updatedAt: string
}

type Tab = 'all' | 'todo' | 'in_progress' | 'done' | 'overdue'

function isOverdue(task: Task): boolean {
  if (task.status === 'done') return false
  if (!task.dueDate) return false
  return new Date(task.dueDate) < new Date()
}

function formatDueDate(dueDate: string | null): { label: string; overdue: boolean } | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())

  const overdue = due < now
  if (dueDay.getTime() === today.getTime()) return { label: 'Today', overdue }
  if (dueDay.getTime() === tomorrow.getTime()) return { label: 'Tomorrow', overdue }
  return {
    label: due.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
    overdue,
  }
}

const PRIORITY_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  low: { dot: 'bg-slate-400', text: 'text-slate-500', label: 'Low' },
  medium: { dot: 'bg-amber-400', text: 'text-amber-600', label: 'Medium' },
  high: { dot: 'bg-red-500', text: 'text-red-600', label: 'High' },
}

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  leadId: '',
  leadSearch: '',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [form, setForm] = useState(EMPTY_FORM)

  // Lead picker
  const [leadResults, setLeadResults] = useState<LeadRef[]>([])
  const [leadDropOpen, setLeadDropOpen] = useState(false)
  const leadSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks?limit=200')
    if (res.ok) {
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Filtered tasks by tab
  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'all') return true
    if (activeTab === 'todo') return t.status === 'todo'
    if (activeTab === 'in_progress') return t.status === 'in_progress'
    if (activeTab === 'done') return t.status === 'done'
    if (activeTab === 'overdue') return isOverdue(t)
    return true
  })

  // Tab counts
  const counts: Record<Tab, number> = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter(isOverdue).length,
  }

  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) ?? null : null

  function openAdd() {
    setSelectedId(null)
    setForm(EMPTY_FORM)
    setLeadResults([])
    setShowAdd(true)
  }

  function openEdit(task: Task) {
    setShowAdd(false)
    setSelectedId(task.id)
    setForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      leadId: task.leadId ?? '',
      leadSearch: task.lead?.name ?? '',
    })
    setLeadResults([])
  }

  async function toggleDone(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    if (selectedId === task.id) {
      setForm((f) => ({ ...f, status: newStatus }))
    }
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  function searchLeads(q: string) {
    setForm((f) => ({ ...f, leadSearch: q, leadId: '' }))
    if (leadSearchTimeout.current) clearTimeout(leadSearchTimeout.current)
    if (!q.trim()) { setLeadResults([]); setLeadDropOpen(false); return }
    leadSearchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/leads?limit=10&search=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        const leads = Array.isArray(data) ? data : data.leads ?? []
        setLeadResults(leads)
        setLeadDropOpen(true)
      }
    }, 300)
  }

  function selectLead(lead: LeadRef) {
    setForm((f) => ({ ...f, leadId: lead.id, leadSearch: lead.name }))
    setLeadDropOpen(false)
  }

  async function saveTask() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (showAdd) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            status: form.status,
            priority: form.priority,
            dueDate: form.dueDate || null,
            leadId: form.leadId || null,
          }),
        })
        if (res.ok) {
          const created = await res.json()
          setTasks((prev) => [created, ...prev])
          setShowAdd(false)
          setSelectedId(created.id)
          setForm({
            title: created.title,
            description: created.description ?? '',
            status: created.status,
            priority: created.priority,
            dueDate: created.dueDate ? created.dueDate.slice(0, 10) : '',
            leadId: created.leadId ?? '',
            leadSearch: created.lead?.name ?? '',
          })
        }
      } else if (selectedId) {
        const res = await fetch(`/api/tasks/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            status: form.status,
            priority: form.priority,
            dueDate: form.dueDate || null,
            leadId: form.leadId || null,
          }),
        })
        if (res.ok) {
          const updated = await res.json()
          setTasks((prev) => prev.map((t) => t.id === selectedId ? updated : t))
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteTask() {
    if (!selectedId) return
    if (!confirm('Delete this task?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${selectedId}`, { method: 'DELETE' })
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== selectedId))
        setSelectedId(null)
        setShowAdd(false)
      }
    } finally {
      setDeleting(false)
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'todo', label: 'To Do' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'done', label: 'Done' },
    { key: 'overdue', label: 'Overdue' },
  ]

  const panelOpen = showAdd || selectedId !== null

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-0 -mt-6 -mx-6 overflow-hidden">
      {/* Left — task list */}
      <div className={`flex flex-col border-r border-slate-200 bg-white ${panelOpen ? 'w-1/2' : 'w-full'} transition-all`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
              <span className="text-sm text-slate-400 font-normal">({tasks.length})</span>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeTab === key ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <CheckSquare className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No tasks here</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filteredTasks.map((task) => {
                const overdue = isOverdue(task)
                const due = formatDueDate(task.dueDate)
                const prio = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
                const isSelected = selectedId === task.id

                return (
                  <li
                    key={task.id}
                    onClick={() => openEdit(task)}
                    className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                      isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'border-l-2 border-transparent'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => toggleDone(task, e)}
                      className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-indigo-500 transition-colors"
                    >
                      {task.status === 'done'
                        ? <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                        : <Circle className="w-5 h-5" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${
                        task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {/* Priority */}
                        <span className={`inline-flex items-center gap-1 text-xs ${prio.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                          {prio.label}
                        </span>
                        {/* Due date */}
                        {due && (
                          <span className={`text-xs ${due.overdue ? 'text-red-500' : 'text-slate-400'}`}>
                            {due.label}
                          </span>
                        )}
                        {/* Lead chip */}
                        {task.lead && (
                          <Link
                            href={`/leads/${task.lead.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                          >
                            {task.lead.name}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right — add/edit panel */}
      {panelOpen ? (
        <div className="w-1/2 flex flex-col bg-white overflow-y-auto">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              {showAdd ? 'New Task' : 'Edit Task'}
            </h2>
          </div>

          <div className="flex-1 px-6 py-5 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Task title…"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Optional notes…"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Lead picker */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Linked Lead</label>
                {form.leadId && (
                  <Link
                    href={`/leads/${form.leadId}`}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  >
                    Open lead <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <input
                type="text"
                value={form.leadSearch}
                onChange={(e) => searchLeads(e.target.value)}
                onFocus={() => form.leadSearch && setLeadDropOpen(leadResults.length > 0)}
                placeholder="Search leads…"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {form.leadId && (
                <button
                  onClick={() => setForm((f) => ({ ...f, leadId: '', leadSearch: '' }))}
                  className="absolute right-3 top-[2.35rem] text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
              {leadDropOpen && leadResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {leadResults.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => selectLead(lead)}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 transition-colors"
                    >
                      {lead.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            {!showAdd ? (
              <button
                onClick={deleteTask}
                disabled={deleting}
                className="flex items-center gap-1.5 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-red-200 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            ) : (
              <button
                onClick={() => { setShowAdd(false); setSelectedId(null) }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={saveTask}
              disabled={saving || !form.title.trim()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {showAdd ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50 text-slate-400 flex-col gap-3">
          <Zap className="w-10 h-10 opacity-20" />
          <p className="text-sm">Select a task or create one</p>
        </div>
      )}
    </div>
  )
}
