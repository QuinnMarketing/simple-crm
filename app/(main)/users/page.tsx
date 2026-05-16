'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2, Plus, Trash2, Pencil, X, Check, ShieldCheck, User, Crown, Building2 } from 'lucide-react'
import ChangePasswordForm from '../settings/ChangePasswordForm'

type UserRow = {
  id: string
  email: string
  name: string | null
  role: string
  accountId: string | null
  accountIds: string[]
  createdAt: string
}

type Account = { id: string; name: string }

type FormState = { name: string; email: string; password: string; role: string; accountIds: string[] }
const EMPTY_FORM: FormState = { name: '', email: '', password: '', role: 'account_user', accountIds: [] }

const ROLE_LABELS: Record<string, string> = {
  master_admin: 'Master Admin',
  account_admin: 'Account Admin',
  account_user: 'User',
  admin: 'Admin',
  user: 'User',
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'master_admin') return <Crown className="w-4 h-4 text-violet-600" />
  if (role === 'account_admin' || role === 'admin') return <ShieldCheck className="w-4 h-4 text-indigo-600" />
  return <User className="w-4 h-4 text-slate-500" />
}

function roleBadgeCls(role: string) {
  if (role === 'master_admin') return 'bg-violet-50 text-violet-700'
  if (role === 'account_admin' || role === 'admin') return 'bg-indigo-50 text-indigo-700'
  return 'bg-slate-100 text-slate-600'
}

function AccountPicker({ accounts, selected, onChange }: {
  accounts: Account[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
      {accounts.length === 0 && (
        <p className="px-3 py-2 text-xs text-slate-400">No accounts found</p>
      )}
      {accounts.map(a => (
        <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
          <input
            type="checkbox"
            checked={selected.includes(a.id)}
            onChange={() => toggle(a.id)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700">{a.name}</span>
        </label>
      ))}
    </div>
  )
}

export default function UsersPage() {
  const { data: session } = useSession()
  const isMasterAdmin = session?.user?.role === 'master_admin'

  const [users, setUsers] = useState<UserRow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => {
    if (!isMasterAdmin) return
    fetch('/api/accounts').then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setAccounts(d)
    })
  }, [isMasterAdmin])

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id.slice(0, 8)

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    setAddError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        role: addForm.role,
        accountId: addForm.accountIds[0] ?? null,
        accountIds: addForm.accountIds,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setUsers((u) => [...u, data])
      setAddForm(EMPTY_FORM)
      setShowAdd(false)
    } else {
      setAddError(data.error)
    }
    setAddSaving(false)
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id)
    setEditForm({ name: user.name ?? '', email: user.email, password: '', role: user.role, accountIds: user.accountIds ?? (user.accountId ? [user.accountId] : []) })
    setEditError('')
  }

  async function saveEdit(id: string) {
    setEditSaving(true)
    setEditError('')
    const payload: Record<string, unknown> = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
    }
    if (editForm.password) payload.password = editForm.password
    if (isMasterAdmin) payload.accountIds = editForm.accountIds
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setUsers((u) => u.map((user) => (user.id === id ? data : user)))
      setEditingId(null)
    } else {
      setEditError(data.error)
    }
    setEditSaving(false)
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return
    setDeletingId(id)
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((u) => u.filter((user) => user.id !== id))
    } else {
      const data = await res.json()
      alert(data.error)
    }
    setDeletingId(null)
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  const roleOptions = isMasterAdmin
    ? [
        { value: 'master_admin', label: 'Master Admin' },
        { value: 'account_admin', label: 'Account Admin' },
        { value: 'account_user', label: 'User' },
      ]
    : [
        { value: 'account_admin', label: 'Account Admin' },
        { value: 'account_user', label: 'User' },
      ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1 text-sm">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddError('') }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">New User</h2>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={addUser} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Name</label>
              <input type="text" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Email <span className="text-red-500">*</span></label>
              <input type="email" required value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
              <input type="password" required minLength={8} value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Role</label>
              <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))} className={inputCls + ' bg-white'}>
                {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {isMasterAdmin && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Business Units
                  <span className="ml-1 normal-case font-normal text-slate-400">(select one or more)</span>
                </label>
                <AccountPicker accounts={accounts} selected={addForm.accountIds} onChange={(ids) => setAddForm(f => ({ ...f, accountIds: ids }))} />
              </div>
            )}
            {addError && (
              <div className="col-span-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</div>
            )}
            <div className="col-span-2 flex gap-3 pt-1">
              <button type="submit" disabled={addSaving} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                {addSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 mb-6">
        {users.map((user) => {
          const isEditing = editingId === user.id
          const isMe = session?.user?.id === user.id
          const userAccountIds = user.accountIds ?? (user.accountId ? [user.accountId] : [])

          return (
            <div key={user.id} className="p-5">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Name</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Email</label>
                    <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">New Password <span className="text-slate-400 font-normal normal-case">(leave blank to keep)</span></label>
                    <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Role</label>
                    <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className={inputCls + ' bg-white'}>
                      {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  {isMasterAdmin && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                        Business Units
                        <span className="ml-1 normal-case font-normal text-slate-400">(select one or more)</span>
                      </label>
                      <AccountPicker accounts={accounts} selected={editForm.accountIds} onChange={(ids) => setEditForm(f => ({ ...f, accountIds: ids }))} />
                    </div>
                  )}
                  {editError && (
                    <div className="col-span-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</div>
                  )}
                  <div className="col-span-2 flex gap-2">
                    <button onClick={() => saveEdit(user.id)} disabled={editSaving} className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                      {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <RoleIcon role={user.role} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900">{user.name || user.email}</p>
                        {isMe && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">you</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeCls(user.role)}`}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                        {isMasterAdmin && userAccountIds.length > 0 && (
                          <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            <Building2 className="w-3 h-3" />
                            {userAccountIds.length === 1
                              ? accountName(userAccountIds[0])
                              : `${userAccountIds.length} units`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {user.name ? user.email : ''}{user.name ? ' · ' : ''}Added {new Date(user.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isMasterAdmin && userAccountIds.length > 1 && (
                          <span className="ml-1 text-slate-400">· {userAccountIds.map(id => accountName(id)).join(', ')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(user)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Edit user">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      disabled={deletingId === user.id || isMe}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={isMe ? "Can't delete your own account" : 'Delete user'}
                    >
                      {deletingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Change Password</h2>
        <p className="text-slate-500 text-sm mb-5">Update the password for your own account.</p>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
