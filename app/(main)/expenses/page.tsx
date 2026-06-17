'use client'
import { useState, useEffect, useCallback } from 'react'
import { Receipt, Plus, Loader2, Edit2, Trash2, Eye } from 'lucide-react'
import ExpenseModal from './ExpenseModal'

type Expense = {
  id: string
  projectId: string
  amount: number
  currency: string
  vendor: string | null
  category: string | null
  description: string | null
  date: string
  imageUrl: string | null
  ocrData: string | null
  status: string
  notes: string | null
  createdAt: string
  project: { id: string; name: string }
}

type Project = {
  id: string
  name: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const CATEGORIES = ['materials', 'labor', 'equipment', 'subcontractor', 'other']

function fmtAUD(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (projectFilter) params.set('projectId', projectFilter)
      const res = await fetch(`/api/expenses?${params}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data)
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err)
    } finally {
      setLoading(false)
    }
  }, [projectFilter])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        setProjects(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const filteredExpenses = expenses.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false
    return true
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setExpenses(expenses.filter((e) => e.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete expense:', err)
    }
  }

  const handleSave = async () => {
    await fetchExpenses()
    setShowModal(false)
    setEditingExpense(null)
  }

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
  const verifiedAmount = filteredExpenses
    .filter((e) => e.status === 'verified')
    .reduce((sum, e) => sum + e.amount, 0)
  const pendingCount = filteredExpenses.filter((e) => e.status === 'pending').length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-slate-500 mt-1 text-sm">Track project expenses and receipts</p>
        </div>
        <button
          onClick={() => {
            setEditingExpense(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Expenses</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{filteredExpenses.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Amount</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{fmtAUD(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Verified Amount</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{fmtAUD(verifiedAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending Review</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Receipt className="w-12 h-12 mb-3 opacity-50" />
            <p>No expenses yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-900">
                      {new Date(expense.date).toLocaleDateString('en-AU')}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{expense.vendor || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.project.name}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{expense.category || '—'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {fmtAUD(expense.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[expense.status]}`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {expense.imageUrl && (
                          <a
                            href={expense.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="View receipt"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setEditingExpense(expense)
                            setShowModal(true)
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseModal
          expense={editingExpense}
          projects={projects}
          onClose={() => {
            setShowModal(false)
            setEditingExpense(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
