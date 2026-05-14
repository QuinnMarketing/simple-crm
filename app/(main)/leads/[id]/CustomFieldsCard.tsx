'use client'
import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, Save, Loader2 } from 'lucide-react'

type FieldWithValue = {
  id: string
  name: string
  type: string
  options: string[]
  required: boolean
  value: string | null
}

export default function CustomFieldsCard({ leadId }: { leadId: string }) {
  const [fields, setFields] = useState<FieldWithValue[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/custom-fields`)
    if (!res.ok) return
    const data: FieldWithValue[] = await res.json()
    setFields(data)
    setValues(Object.fromEntries(data.map((f) => [f.id, f.value ?? ''])))
    setLoaded(true)
  }, [leadId])

  useEffect(() => { load() }, [load])

  function setValue(id: string, val: string) {
    setValues((v) => ({ ...v, [id]: val }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/leads/${leadId}/custom-fields`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setDirty(false)
    setSaving(false)
  }

  if (!loaded || fields.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="font-semibold text-slate-900">Custom Fields</h2>
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.type === 'text' && (
              <input
                type="text"
                value={values[field.id] ?? ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            {field.type === 'textarea' && (
              <textarea
                rows={3}
                value={values[field.id] ?? ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            )}
            {field.type === 'number' && (
              <input
                type="number"
                value={values[field.id] ?? ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            {field.type === 'date' && (
              <input
                type="date"
                value={values[field.id] ?? ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            {field.type === 'select' && (
              <select
                value={values[field.id] ?? ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select —</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {field.type === 'checkbox' && (
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={values[field.id] === 'true'}
                  onChange={(e) => setValue(field.id, e.target.checked ? 'true' : '')}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">{field.name}</span>
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
