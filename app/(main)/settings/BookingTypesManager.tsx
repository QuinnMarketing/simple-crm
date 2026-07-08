'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, Pencil, Trash2, Clock, X } from 'lucide-react'

type BookingType = {
  id: string
  name: string
  category: string | null
  description: string | null
  durationMin: number
  price: number | null
  priceType: string
  bufferBefore: number
  bufferAfter: number
  onlineBookable: boolean
  active: boolean
}

type Draft = {
  name: string
  category: string
  description: string
  durationMin: number
  price: string
  priceType: string
  bufferBefore: number
  bufferAfter: number
  onlineBookable: boolean
  active: boolean
}

const EMPTY: Draft = {
  name: '', category: '', description: '', durationMin: 60, price: '', priceType: 'fixed',
  bufferBefore: 0, bufferAfter: 0, onlineBookable: true, active: true,
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1'

export default function BookingTypesManager({ accountId }: { accountId: string | null }) {
  const qs = accountId ? `?account=${accountId}` : ''
  const [types, setTypes] = useState<BookingType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/booking-types${qs}`)
    if (r.ok) setTypes(await r.json())
    setLoading(false)
  }, [qs])

  useEffect(() => { load() }, [load])

  function startAdd() {
    setDraft(EMPTY)
    setEditingId('new')
    setError('')
  }
  function startEdit(t: BookingType) {
    setDraft({
      name: t.name, category: t.category ?? '', description: t.description ?? '',
      durationMin: t.durationMin, price: t.price != null ? String(t.price) : '', priceType: t.priceType,
      bufferBefore: t.bufferBefore, bufferAfter: t.bufferAfter, onlineBookable: t.onlineBookable, active: t.active,
    })
    setEditingId(t.id)
    setError('')
  }

  async function save() {
    if (!draft.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const isNew = editingId === 'new'
    const url = isNew ? `/api/booking-types${qs}` : `/api/booking-types/${editingId}`
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, ...(isNew && accountId ? { accountId } : {}) }),
    })
    if (res.ok) {
      setEditingId(null)
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Save failed')
    }
    setSaving(false)
  }

  async function remove(t: BookingType) {
    if (!confirm(`Delete "${t.name}"? Existing appointments keep their details.`)) return
    const res = await fetch(`/api/booking-types/${t.id}`, { method: 'DELETE' })
    if (res.ok) setTypes((prev) => prev.filter((x) => x.id !== t.id))
  }

  function priceLabel(t: BookingType): string {
    if (t.priceType === 'free') return 'Free'
    if (t.price == null) return '—'
    const amt = `$${t.price % 1 === 0 ? t.price : t.price.toFixed(2)}`
    return t.priceType === 'from' ? `from ${amt}` : amt
  }

  if (loading) {
    return <div className="flex items-center py-4 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading services…</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-600">Services clients can choose when booking. Each has its own length and price. Leave empty to offer a single generic appointment using the widget defaults above.</p>
      </div>

      {types.length > 0 && (
        <div className="space-y-2 mb-3">
          {types.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900 text-sm">{t.name}</span>
                  {t.category && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.category}</span>}
                  {!t.onlineBookable && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Hidden online</span>}
                  {!t.active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactive</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.durationMin} min</span>
                  <span>· {priceLabel(t)}</span>
                  {(t.bufferBefore > 0 || t.bufferAfter > 0) && <span>· buffer {t.bufferBefore}/{t.bufferAfter}m</span>}
                </p>
              </div>
              <button onClick={() => startEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(t)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {editingId ? (
        <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-slate-900 text-sm">{editingId === 'new' ? 'New service' : 'Edit service'}</h4>
            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Name <span className="text-red-500">*</span></label>
              <input className={inputCls} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Consultation" />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <input className={inputCls} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label className={labelCls}>Duration (min)</label>
              <input type="number" min={5} step={5} className={inputCls} value={draft.durationMin} onChange={(e) => setDraft((d) => ({ ...d, durationMin: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Description</label>
              <input className={inputCls} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Shown on the booking page" />
            </div>
            <div>
              <label className={labelCls}>Price type</label>
              <select className={inputCls} value={draft.priceType} onChange={(e) => setDraft((d) => ({ ...d, priceType: e.target.value }))}>
                <option value="fixed">Fixed</option>
                <option value="from">From</option>
                <option value="free">Free</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Price</label>
              <input type="number" min={0} step="0.01" className={inputCls} value={draft.price} disabled={draft.priceType === 'free'} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Buffer before (min)</label>
              <input type="number" min={0} step={5} className={inputCls} value={draft.bufferBefore} onChange={(e) => setDraft((d) => ({ ...d, bufferBefore: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Buffer after (min)</label>
              <input type="number" min={0} step={5} className={inputCls} value={draft.bufferAfter} onChange={(e) => setDraft((d) => ({ ...d, bufferAfter: Number(e.target.value) }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={draft.onlineBookable} onChange={(e) => setDraft((d) => ({ ...d, onlineBookable: e.target.checked }))} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Bookable online
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Active
            </label>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId === 'new' ? 'Add service' : 'Save changes'}
            </button>
            <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={startAdd} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
          <Plus className="w-4 h-4" /> Add service
        </button>
      )}
    </div>
  )
}
