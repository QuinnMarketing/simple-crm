'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, X, Check, Building2 } from 'lucide-react'

type Company = {
  id: string
  name: string
  color: string
  createdAt: string
  _count: { leads: number }
}

const PRESET_COLORS = [
  { label: 'Indigo',   value: '#6366f1' },
  { label: 'Sky',      value: '#0ea5e9' },
  { label: 'Emerald',  value: '#10b981' },
  { label: 'Amber',    value: '#f59e0b' },
  { label: 'Rose',     value: '#f43f5e' },
  { label: 'Violet',   value: '#8b5cf6' },
  { label: 'Orange',   value: '#f97316' },
  { label: 'Teal',     value: '#14b8a6' },
]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className={`w-6 h-6 rounded-full transition-transform ${value === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  )
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addColor, setAddColor] = useState('#6366f1')
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchCompanies = useCallback(async () => {
    const res = await fetch('/api/companies')
    if (res.ok) setCompanies(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  async function addCompany(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    setAddError('')
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, color: addColor }),
    })
    const data = await res.json()
    if (res.ok) {
      setCompanies((c) => [...c, data].sort((a, b) => a.name.localeCompare(b.name)))
      setAddName('')
      setAddColor('#6366f1')
      setShowAdd(false)
    } else {
      setAddError(data.error)
    }
    setAddSaving(false)
  }

  function startEdit(company: Company) {
    setEditingId(company.id)
    setEditName(company.name)
    setEditColor(company.color)
  }

  async function saveEdit(id: string) {
    setEditSaving(true)
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, color: editColor }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCompanies((cs) => cs.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingId(null)
    }
    setEditSaving(false)
  }

  async function deleteCompany(company: Company) {
    const msg = company._count.leads > 0
      ? `Delete "${company.name}"? Its ${company._count.leads} lead${company._count.leads !== 1 ? 's' : ''} will be unassigned but not deleted.`
      : `Delete "${company.name}"?`
    if (!confirm(msg)) return
    setDeletingId(company.id)
    const res = await fetch(`/api/companies/${company.id}`, { method: 'DELETE' })
    if (res.ok) setCompanies((cs) => cs.filter((c) => c.id !== company.id))
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-slate-500 mt-1 text-sm">Organise leads by business or client</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddError('') }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">New Company</h2>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={addCompany} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Dominate Concrete"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Colour</label>
              <ColorPicker value={addColor} onChange={setAddColor} />
            </div>
            {addError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={addSaving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {addSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Company'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {companies.length === 0 && (
          <div className="px-5 py-12 text-center text-slate-400 text-sm">
            No companies yet. Add one to start organising your leads.
          </div>
        )}
        {companies.map((company) => (
          <div key={company.id} className="p-5">
            {editingId === company.id ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Colour</label>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(company.id)}
                    disabled={editSaving}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
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
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: company.color + '20' }}>
                    <Building2 className="w-4 h-4" style={{ color: company.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: company.color }} />
                      <p className="text-sm font-medium text-slate-900">{company.name}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {company._count.leads} lead{company._count.leads !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(company)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteCompany(company)}
                    disabled={deletingId === company.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    {deletingId === company.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
