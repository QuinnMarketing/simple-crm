'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, X, Settings2, ToggleLeft, ToggleRight, Users, Pencil, Check } from 'lucide-react'
import Link from 'next/link'

type Account = {
  id: string
  name: string
  slug: string
  plan: string
  isActive: boolean
  featTakeoffs: boolean
  webhookToken: string
  createdAt: string
  _count: { users: number; leads: number }
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-slate-100 text-slate-600',
  pro: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-violet-100 text-violet-700',
}

const PLAN_OPTIONS = ['starter', 'pro', 'enterprise']

export default function AccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPlan, setAddPlan] = useState('starter')
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPlan, setEditPlan] = useState('starter')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts')
    if (res.ok) {
      setAccounts(await res.json())
    } else {
      const data = await res.json().catch(() => ({}))
      setFetchError(data.error ?? `Request failed (${res.status})`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    setAddError('')
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, plan: addPlan }),
    })
    const data = await res.json()
    if (res.ok) {
      setAccounts((a) => [...a, data].sort((x, y) => x.name.localeCompare(y.name)))
      setAddName('')
      setAddPlan('starter')
      setShowAdd(false)
      router.refresh()
    } else {
      setAddError(data.error)
    }
    setAddSaving(false)
  }

  function startEdit(account: Account) {
    setEditingId(account.id)
    setEditName(account.name)
    setEditPlan(account.plan)
    setEditError('')
  }

  async function saveEdit(id: string) {
    setEditSaving(true)
    setEditError('')
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, plan: editPlan }),
    })
    const data = await res.json()
    if (res.ok) {
      setAccounts((a) => a.map((acc) => acc.id === id ? { ...acc, ...data } : acc))
      setEditingId(null)
      router.refresh()
    } else {
      setEditError(data.error ?? 'Failed to save')
    }
    setEditSaving(false)
  }

  async function toggleActive(account: Account) {
    setTogglingId(account.id)
    const res = await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !account.isActive }),
    })
    if (res.ok) {
      const updated = await res.json()
      setAccounts((a) => a.map((acc) => acc.id === account.id ? { ...acc, ...updated } : acc))
      router.refresh()
    }
    setTogglingId(null)
  }

  async function toggleTakeoffs(account: Account) {
    const res = await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featTakeoffs: !account.featTakeoffs }),
    })
    if (res.ok) {
      const updated = await res.json()
      setAccounts((a) => a.map((acc) => acc.id === account.id ? { ...acc, ...updated } : acc))
    }
  }

  async function deleteAccount(account: Account) {
    if (!confirm(
      `Delete "${account.name}"? This will permanently delete all associated leads, companies, users and integrations. This cannot be undone.`
    )) return
    setDeletingId(account.id)
    const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
    if (res.ok) {
      setAccounts((a) => a.filter((acc) => acc.id !== account.id))
      router.refresh()
    } else {
      alert('Failed to delete account.')
    }
    setDeletingId(null)
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (fetchError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Accounts</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800 font-medium">Failed to load accounts</p>
          <p className="text-red-700 text-sm mt-1">{fetchError}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="text-slate-500 mt-1 text-sm">{accounts.length} client account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddError('') }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">New Account</h2>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={addAccount} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Acme Corp"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Plan</label>
              <select value={addPlan} onChange={(e) => setAddPlan(e.target.value)} className={inputCls + ' bg-white'}>
                {PLAN_OPTIONS.map((p) => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            {addError && (
              <div className="col-span-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {addError}
              </div>
            )}
            <div className="col-span-2 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={addSaving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {addSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Account'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {accounts.length === 0 && (
          <div className="px-5 py-12 text-center text-slate-400 text-sm">
            No accounts yet. Create one to onboard a client.
          </div>
        )}
        {accounts.map((account) => {
          const isEditing = editingId === account.id
          return (
            <div key={account.id} className="p-5">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Account Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputCls}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Plan</label>
                    <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className={inputCls + ' bg-white'}>
                      {PLAN_OPTIONS.map((p) => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                  {editError && (
                    <div className="col-span-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</div>
                  )}
                  <div className="col-span-2 flex gap-2">
                    <button
                      onClick={() => saveEdit(account.id)}
                      disabled={editSaving}
                      className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                    >
                      {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Account header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${account.isActive ? 'bg-green-400' : 'bg-slate-300'}`} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">{account.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${PLAN_COLORS[account.plan] ?? 'bg-slate-100 text-slate-600'}`}>
                            {account.plan}
                          </span>
                          {!account.isActive && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {account._count.users} user{account._count.users !== 1 ? 's' : ''} · {account._count.leads} lead{account._count.leads !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(account)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit account"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/settings?account=${account.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Settings2 className="w-4 h-4" />
                        Settings
                      </Link>
                      <button
                        onClick={() => toggleActive(account)}
                        disabled={togglingId === account.id}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title={account.isActive ? 'Deactivate account' : 'Activate account'}
                      >
                        {togglingId === account.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : account.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteAccount(account)}
                        disabled={deletingId === account.id}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Delete account"
                      >
                        {deletingId === account.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Features row */}
                  <div className="flex items-center gap-2 pl-6 pt-1 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide mr-1">Features</span>
                    <button
                      onClick={() => toggleTakeoffs(account)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium border transition-colors ${
                        account.featTakeoffs
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {account.featTakeoffs
                        ? <ToggleRight className="w-4 h-4" />
                        : <ToggleLeft className="w-4 h-4" />
                      }
                      Takeoffs & Estimating
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
