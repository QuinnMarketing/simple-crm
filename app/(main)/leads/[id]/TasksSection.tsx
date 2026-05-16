'use client'
import { useState, useEffect, useCallback } from 'react'
import { Circle, CheckCircle2, Plus, Loader2, X } from 'lucide-react'

type Task = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-400',
  high: 'bg-red-500',
}

function isOverdue(task: Task): boolean {
  if (task.status === 'done') return false
  if (!task.dueDate) return false
  return new Date(task.dueDate) < new Date()
}

function formatDue(dueDate: string | null): string | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())

  if (dueDay.getTime() === today.getTime()) return 'Today'
  if (dueDay.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return due.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

type InlineForm = {
  title: string
  dueDate: string
  priority: string
}

export default function TasksSection({ leadId }: { leadId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<InlineForm>({ title: '', dueDate: '', priority: 'medium' })

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?leadId=${leadId}&limit=50`)
    if (res.ok) {
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [leadId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function toggleDone(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function addTask() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          priority: form.priority,
          dueDate: form.dueDate || null,
          leadId,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks((prev) => [created, ...prev])
        setForm({ title: '', dueDate: '', priority: 'medium' })
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Tasks</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title…"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter') addTask() }}
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setForm({ title: '', dueDate: '', priority: 'medium' }) }}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addTask}
              disabled={saving || !form.title.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Loading…
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-5 text-slate-400">
          <p className="text-sm">No tasks yet</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => {
            const overdue = isOverdue(task)
            const due = formatDue(task.dueDate)
            const dotColor = PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium

            return (
              <li key={task.id} className="flex items-start gap-2.5 py-1.5">
                <button
                  onClick={() => toggleDone(task)}
                  className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-indigo-500 transition-colors"
                >
                  {task.status === 'done'
                    ? <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                    : <Circle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                    {due && (
                      <span className={`text-xs ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                        {due}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
