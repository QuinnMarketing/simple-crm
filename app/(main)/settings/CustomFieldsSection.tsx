'use client'
import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'

type CustomField = {
  id: string
  name: string
  type: FieldType
  options: string[]
  required: boolean
  order: number
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  checkbox: 'Checkbox',
}

export default function CustomFieldsSection({ accountId }: { accountId: string }) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<FieldType>('text')
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/custom-fields?account=${accountId}`)
    const data = await res.json()
    setFields(data.map((f: CustomField & { options: unknown }) => ({
      ...f,
      options: Array.isArray(f.options) ? f.options : [],
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [accountId])

  async function addField() {
    if (!newName.trim()) return
    setAdding(true)
    await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, name: newName.trim(), type: newType }),
    })
    setNewName('')
    setNewType('text')
    await load()
    setAdding(false)
  }

  async function deleteField(id: string) {
    if (!confirm('Delete this field? All saved values will be lost.')) return
    await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    setFields((f) => f.filter((x) => x.id !== id))
  }

  async function updateField(id: string, patch: Partial<CustomField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
    await fetch(`/api/custom-fields/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...patch,
        options: patch.options ?? undefined,
      }),
    })
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= fields.length) return
    const updated = [...fields]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    const reordered = updated.map((f, i) => ({ ...f, order: i }))
    setFields(reordered)
    await Promise.all(
      reordered.map((f) => fetch(`/api/custom-fields/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: f.order }),
      }))
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-900 mb-1">Custom Fields</h2>
      <p className="text-sm text-slate-500 mb-5">Add extra fields that appear on every lead in your account.</p>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-2 mb-5">
          {fields.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
              No custom fields yet.
            </p>
          )}
          {fields.map((field, idx) => (
            <div key={field.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(field.id, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => move(field.id, 1)} disabled={idx === fields.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800">{field.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{TYPE_LABELS[field.type]}</span>
                  {field.required && <span className="ml-2 text-xs text-red-500">required</span>}
                </div>
                <button
                  onClick={() => setExpanded(expanded === field.id ? null : field.id)}
                  className="text-xs text-indigo-600 hover:underline px-2 py-1"
                >
                  {expanded === field.id ? 'Done' : 'Edit'}
                </button>
                <button onClick={() => deleteField(field.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {expanded === field.id && (
                <div className="px-4 py-3 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Label</label>
                      <input
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Type</label>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {Object.entries(TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {field.type === 'select' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Options (one per line)</label>
                      <textarea
                        rows={3}
                        value={field.options.join('\n')}
                        onChange={(e) => updateField(field.id, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="Option A&#10;Option B&#10;Option C"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Required field</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addField()}
          placeholder="Field name…"
          className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as FieldType)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          onClick={addField}
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  )
}
