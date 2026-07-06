'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Loader2, Check, ChevronDown,
  GripVertical, Save, FolderOpen, User, MapIcon, ListIcon
} from 'lucide-react'
import PlanMarkup from './PlanMarkup'

type LineItem = {
  id: string
  section: string
  description: string
  quantity: number
  unit: string
  unitCost: number
  markup: number
  total: number
}

type Project = { id: string; name: string; color: string }
type Lead = { id: string; name: string }

type Takeoff = {
  id: string
  name: string
  description: string | null
  status: string
  lineItems: string
  subtotal: number
  total: number
  notes: string | null
  projectId: string | null
  leadId: string | null
  project: Project | null
  lead: Lead | null
}

const STATUSES = ['draft', 'sent', 'approved', 'rejected']
const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-700',
  sent:     'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const UNITS = ['m²', 'm³', 'lm', 'm', 'hr', 'day', 'ea', 'tonne', 'kg', 'L', 'bag', 'roll', 'sheet', 'lot']

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function calcItemTotal(item: Pick<LineItem, 'quantity' | 'unitCost' | 'markup'>) {
  const base = (item.quantity ?? 0) * (item.unitCost ?? 0)
  return base * (1 + (item.markup ?? 0) / 100)
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

export default function TakeoffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tab, setTab] = useState<'estimate' | 'plans'>('estimate')

  const [takeoff, setTakeoff] = useState<Takeoff | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('draft')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([])

  const [projects, setProjects] = useState<Project[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [leadId, setLeadId] = useState<string>('')

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [addSectionName, setAddSectionName] = useState('')
  const [showAddSection, setShowAddSection] = useState(false)

  useEffect(() => {
    fetch(`/api/takeoffs/${id}`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const t: Takeoff = await r.json()
        setTakeoff(t)
        setName(t.name)
        setDescription(t.description ?? '')
        setStatus(t.status)
        setNotes(t.notes ?? '')
        setProjectId(t.projectId ?? '')
        setLeadId(t.leadId ?? '')
        const parsed = JSON.parse(t.lineItems || '[]')
        setItems(Array.isArray(parsed) ? parsed : [])
        setLoading(false)
      })
      .catch(() => { setLoading(false); setNotFound(true) })

    fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
    fetch('/api/leads').then(r => r.json()).then(d => {
      const arr = Array.isArray(d) ? d : (d?.leads ?? [])
      setLeads(arr.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })))
    }).catch(() => {})
  }, [id])

  const save = useCallback(async (
    overrides?: Partial<{ name: string; description: string; status: string; notes: string; items: LineItem[]; projectId: string; leadId: string }>
  ) => {
    setSaveState('saving')
    const body = {
      name: overrides?.name ?? name,
      description: overrides?.description ?? description,
      status: overrides?.status ?? status,
      notes: overrides?.notes ?? notes,
      lineItems: overrides?.items ?? items,
      projectId: overrides?.projectId ?? projectId,
      leadId: overrides?.leadId ?? leadId,
    }
    await fetch(`/api/takeoffs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2000)
  }, [id, name, description, status, notes, items, projectId, leadId])

  function scheduleSave(overrides?: Parameters<typeof save>[0]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(overrides), 1500)
  }

  function updateName(v: string) { setName(v); scheduleSave({ name: v }) }
  function updateDescription(v: string) { setDescription(v); scheduleSave({ description: v }) }
  function updateStatus(v: string) { setStatus(v); save({ status: v }) }
  function updateNotes(v: string) { setNotes(v); scheduleSave({ notes: v }) }
  function updateProject(v: string) { setProjectId(v); save({ projectId: v }) }
  function updateLead(v: string) { setLeadId(v); save({ leadId: v }) }

  function updateItem(itemId: string, field: keyof LineItem, value: string | number) {
    setItems(prev => {
      const next = prev.map(it => {
        if (it.id !== itemId) return it
        const updated = { ...it, [field]: value }
        updated.total = calcItemTotal(updated)
        return updated
      })
      scheduleSave({ items: next })
      return next
    })
  }

  function addItem(section: string) {
    const newItem: LineItem = {
      id: uid(),
      section,
      description: '',
      quantity: 1,
      unit: 'ea',
      unitCost: 0,
      markup: 0,
      total: 0,
    }
    setItems(prev => {
      const next = [...prev, newItem]
      scheduleSave({ items: next })
      return next
    })
  }

  function removeItem(itemId: string) {
    setItems(prev => {
      const next = prev.filter(it => it.id !== itemId)
      scheduleSave({ items: next })
      return next
    })
  }

  function addSection() {
    const trimmed = addSectionName.trim()
    if (!trimmed) return
    const newItem: LineItem = {
      id: uid(),
      section: trimmed,
      description: '',
      quantity: 1,
      unit: 'ea',
      unitCost: 0,
      markup: 0,
      total: 0,
    }
    setItems(prev => {
      const next = [...prev, newItem]
      scheduleSave({ items: next })
      return next
    })
    setAddSectionName('')
    setShowAddSection(false)
  }

  function removeSection(sectionName: string) {
    if (!confirm(`Remove the "${sectionName}" section and all its items?`)) return
    setItems(prev => {
      const next = prev.filter(it => it.section !== sectionName)
      scheduleSave({ items: next })
      return next
    })
  }

  // Derive ordered sections from items
  const sections: string[] = []
  for (const item of items) {
    if (!sections.includes(item.section)) sections.push(item.section)
  }

  const grandTotal = items.reduce((s, it) => s + (it.total ?? 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500">Takeoff not found.</p>
        <button onClick={() => router.push('/takeoffs')} className="mt-4 text-indigo-600 text-sm hover:underline">← Back to takeoffs</button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => router.push('/takeoffs')}
          className="mt-1 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={e => updateName(e.target.value)}
            className="w-full text-2xl font-bold text-slate-900 bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-slate-300 focus:rounded-lg focus:px-2 focus:py-1 -ml-0.5 transition-all"
            placeholder="Estimate name…"
          />
          <input
            type="text"
            value={description}
            onChange={e => updateDescription(e.target.value)}
            className="w-full text-sm text-slate-500 bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-slate-300 focus:rounded-lg focus:px-2 focus:py-0.5 mt-1 transition-all"
            placeholder="Add a description…"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save indicator */}
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {/* Status */}
          <select
            value={status}
            onChange={e => updateStatus(e.target.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 ${STATUS_COLORS[status]}`}
          >
            {STATUSES.map(s => (
              <option key={s} value={s} className="capitalize bg-white text-slate-900">
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Links to project/lead */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={projectId}
            onChange={e => updateProject(e.target.value)}
            className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">No project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={leadId}
            onChange={e => updateLead(e.target.value)}
            className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">No lead</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4 w-fit">
        <button
          onClick={() => setTab('estimate')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'estimate' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ListIcon className="w-4 h-4" /> Estimate
        </button>
        <button
          onClick={() => setTab('plans')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'plans' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapIcon className="w-4 h-4" /> Plans & Markup
        </button>
      </div>

      {/* Plans tab */}
      {tab === 'plans' && (
        <PlanMarkup
          takeoffId={id}
          sections={sections}
          onAddToTakeoff={(section, description, quantity, unit) => {
            const newItem: LineItem = {
              id: uid(),
              section,
              description,
              quantity,
              unit,
              unitCost: 0,
              markup: 0,
              total: 0,
            }
            setItems(prev => {
              const next = [...prev, newItem]
              scheduleSave({ items: next })
              return next
            })
            setTab('estimate')
          }}
        />
      )}

      {tab === 'estimate' && (
      <>
      {/* Sections */}
      {sections.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center mb-4">
          <p className="text-slate-400 text-sm">No items yet. Add a section to get started.</p>
        </div>
      )}

      {sections.map(section => {
        const sectionItems = items.filter(it => it.section === section)
        const sectionTotal = sectionItems.reduce((s, it) => s + (it.total ?? 0), 0)
        return (
          <div key={section} className="mb-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">{section}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">{fmt(sectionTotal)}</span>
                <button
                  onClick={() => addItem(section)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
                <button
                  onClick={() => removeSection(section)}
                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Column headers */}
            {sectionItems.length > 0 && (
              <div className="grid grid-cols-[1fr_80px_80px_100px_80px_100px_32px] gap-2 px-4 py-2 bg-slate-50/50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase tracking-wide">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span>Unit</span>
                <span className="text-right">Unit Cost</span>
                <span className="text-right">Markup %</span>
                <span className="text-right">Total</span>
                <span />
              </div>
            )}

            {/* Items */}
            {sectionItems.map(item => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_80px_80px_100px_80px_100px_32px] gap-2 px-4 py-2 border-b border-slate-50 hover:bg-slate-50/50 items-center group"
              >
                <input
                  type="text"
                  value={item.description}
                  onChange={e => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Description…"
                  className="text-sm text-slate-800 bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-slate-300 focus:rounded px-1 py-0.5 w-full"
                />
                <input
                  type="number"
                  value={item.quantity || ''}
                  onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  step="any"
                  className="text-sm text-right text-slate-800 bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-slate-300 focus:rounded px-1 py-0.5 w-full"
                />
                <select
                  value={item.unit}
                  onChange={e => updateItem(item.id, 'unit', e.target.value)}
                  className="text-sm text-slate-700 bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-slate-300 focus:rounded px-1 py-0.5 cursor-pointer"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  {!UNITS.includes(item.unit) && item.unit && (
                    <option value={item.unit}>{item.unit}</option>
                  )}
                </select>
                <div className="relative">
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                  <input
                    type="number"
                    value={item.unitCost || ''}
                    onChange={e => updateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    min={0}
                    step="any"
                    className="text-sm text-right text-slate-800 bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-slate-300 focus:rounded pl-4 pr-1 py-0.5 w-full"
                  />
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={item.markup || ''}
                    onChange={e => updateItem(item.id, 'markup', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min={0}
                    max={999}
                    step="any"
                    className="text-sm text-right text-slate-800 bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-slate-300 focus:rounded pr-5 pl-1 py-0.5 w-full"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
                </div>
                <p className="text-sm font-medium text-slate-800 text-right tabular-nums">
                  {item.total > 0 ? fmt(item.total) : '—'}
                </p>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {sectionItems.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-400 italic">
                No items — click <strong>Add Item</strong> above
              </div>
            )}
          </div>
        )
      })}

      {/* Add section */}
      <div className="mb-6">
        {showAddSection ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={addSectionName}
              onChange={e => setAddSectionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setShowAddSection(false) }}
              placeholder="Section name (e.g. Materials, Labour, Equipment)…"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button
              onClick={addSection}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
            <button
              onClick={() => setShowAddSection(false)}
              className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddSection(true)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 px-3 py-2 border border-dashed border-slate-300 hover:border-indigo-400 rounded-lg transition-colors w-full justify-center"
          >
            <Plus className="w-4 h-4" /> Add Section
          </button>
        )}
      </div>

      {/* Grand total */}
      {sections.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          {sections.map(section => {
            const sTotal = items.filter(it => it.section === section).reduce((s, it) => s + (it.total ?? 0), 0)
            return (
              <div key={section} className="flex justify-between text-sm text-slate-600 py-1.5 border-b border-slate-100 last:border-0">
                <span>{section}</span>
                <span className="font-medium tabular-nums">{fmt(sTotal)}</span>
              </div>
            )
          })}
          <div className="flex justify-between text-base font-bold text-slate-900 pt-3 mt-1">
            <span>Total (excl. GST)</span>
            <span className="tabular-nums">{fmt(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500 pt-1">
            <span>GST (10%)</span>
            <span className="tabular-nums">{fmt(grandTotal * 0.1)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-indigo-700 pt-2 border-t border-slate-200 mt-2">
            <span>Total (incl. GST)</span>
            <span className="tabular-nums">{fmt(grandTotal * 1.1)}</span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={e => updateNotes(e.target.value)}
          placeholder="Add any notes, assumptions, exclusions…"
          rows={4}
          className="w-full text-sm text-slate-700 bg-transparent border-0 outline-none resize-none focus:bg-slate-50 focus:rounded-lg focus:p-2 transition-all"
        />
      </div>
      </>
      )}
    </div>
  )
}
