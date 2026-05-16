'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Pencil, Trash2, Loader2, X, Check, Tag, ToggleLeft, ToggleRight, Upload, Download } from 'lucide-react'

type PriceItem = {
  id: string
  name: string
  description: string | null
  price: number
  unit: string
  category: string | null
  sku: string | null
  active: boolean
  createdAt: string
}

const UNITS = ['each', 'hr', 'day', 'week', 'm²', 'm³', 'lm', 'kg', 't', 'job', 'visit', 'item']
const CSV_HEADERS = ['name', 'description', 'price', 'unit', 'category', 'sku', 'active']

function fmt(price: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(price)
}

function csvCell(val: string) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function parseCSV(text: string): Record<string, string>[] {
  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current); current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase())
  return lines.slice(1).map(l => {
    const vals = parseLine(l)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

type FormState = {
  name: string
  description: string
  price: string
  unit: string
  category: string
  sku: string
}

const EMPTY_FORM: FormState = { name: '', description: '', price: '', unit: 'each', category: '', sku: '' }

function ItemModal({
  initial,
  categories,
  onSave,
  onClose,
  saving,
}: {
  initial: FormState
  categories: string[]
  onSave: (data: FormState) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [showCatSuggestions, setShowCatSuggestions] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const catMatches = categories.filter(c => c.toLowerCase().includes(form.category.toLowerCase()) && c !== form.category)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">{initial.name ? 'Edit item' : 'New item'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input ref={nameRef} value={form.name} onChange={set('name')}
              placeholder="e.g. Kitchen Renovation"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input value={form.price} onChange={set('price')} type="number" min="0" step="0.01"
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <select value={form.unit} onChange={set('unit')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input value={form.category} onChange={set('category')}
                onFocus={() => setShowCatSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCatSuggestions(false), 150)}
                placeholder="e.g. Labour"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              {showCatSuggestions && catMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {catMatches.map(c => (
                    <button key={c} onMouseDown={() => setForm(f => ({ ...f, category: c }))}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700">{c}</button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Code</label>
              <input value={form.sku} onChange={set('sku')} placeholder="e.g. LAB-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2}
              placeholder="Optional description or notes…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name.trim() || !form.price}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {initial.name ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PriceBookPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined

  const [items, setItems] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; item?: PriceItem }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (accountParam) qs.set('account', accountParam)
    const r = await fetch(`/api/price-book?${qs}`)
    if (r.ok) setItems(await r.json())
    setLoading(false)
  }, [accountParam])

  useEffect(() => { load() }, [load])

  const categories = [...new Set(items.map(i => i.category).filter(Boolean) as string[])].sort()

  const visible = items.filter(i => {
    if (!showInactive && !i.active) return false
    if (catFilter !== 'all' && i.category !== catFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return i.name.toLowerCase().includes(q) ||
        (i.sku?.toLowerCase().includes(q) ?? false) ||
        (i.category?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  const grouped = catFilter === 'all'
    ? visible.reduce<Record<string, PriceItem[]>>((acc, item) => {
        const key = item.category ?? '—'
        ;(acc[key] ??= []).push(item)
        return acc
      }, {})
    : { [catFilter]: visible }

  async function handleSave(form: FormState) {
    setSaving(true)
    try {
      if (modal.item) {
        const r = await fetch(`/api/price-book/${modal.item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (r.ok) {
          const updated = await r.json()
          setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
        }
      } else {
        const r = await fetch('/api/price-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, accountParam }),
        })
        if (r.ok) { const newItem = await r.json(); setItems(prev => [...prev, newItem]) }
      }
      setModal({ open: false })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: PriceItem) {
    const r = await fetch(`/api/price-book/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    })
    if (r.ok) {
      const updated = await r.json()
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return
    setDeleting(id)
    await fetch(`/api/price-book/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  function handleExport() {
    const rows = items.map(i => [
      csvCell(i.name),
      csvCell(i.description ?? ''),
      i.price,
      csvCell(i.unit),
      csvCell(i.category ?? ''),
      csvCell(i.sku ?? ''),
      i.active,
    ].join(','))
    const csv = [CSV_HEADERS.join(','), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'price-book.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length === 0) { alert('No valid rows found. Ensure the CSV has a header row with at least name and price columns.'); return }
      const r = await fetch('/api/price-book/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, accountParam }),
      })
      const data = await r.json()
      if (!r.ok) { alert(data.error ?? 'Import failed'); return }
      await load()
    } finally {
      setImporting(false)
    }
  }

  const totalActive = items.filter(i => i.active).length

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Price Book</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalActive} active item{totalActive !== 1 ? 's' : ''} across {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Import CSV"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import
          </button>
          <button
            onClick={handleExport}
            disabled={items.length === 0}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setCatFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${catFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              All
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c === catFilter ? 'all' : c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${catFilter === c ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-auto">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Show inactive
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <Tag className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">
            {items.length === 0 ? 'No items yet' : 'No items match your filters'}
          </p>
          {items.length === 0 && (
            <button onClick={() => setModal({ open: true })}
              className="mt-3 text-indigo-600 text-sm hover:underline">Add your first item</button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)))
            .map(([cat, catItems]) => (
              <div key={cat}>
                {catFilter === 'all' && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cat}</span>
                    <span className="text-xs text-slate-300">({catItems.length})</span>
                  </div>
                )}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">SKU</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {catItems.map(item => (
                        <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${!item.active ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{item.name}</p>
                            {item.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {item.sku ? (
                              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{item.sku}</span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                            {fmt(item.price)}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">/{item.unit}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleActive(item)} title={item.active ? 'Deactivate' : 'Activate'}
                              className="text-slate-400 hover:text-indigo-600 transition-colors">
                              {item.active
                                ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                                : <ToggleLeft className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => setModal({
                                open: true,
                                item,
                              })} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                                className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                {deleting === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}

      {modal.open && (
        <ItemModal
          initial={modal.item
            ? { name: modal.item.name, description: modal.item.description ?? '', price: String(modal.item.price), unit: modal.item.unit, category: modal.item.category ?? '', sku: modal.item.sku ?? '' }
            : EMPTY_FORM}
          categories={categories}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
          saving={saving}
        />
      )}
    </div>
  )
}
