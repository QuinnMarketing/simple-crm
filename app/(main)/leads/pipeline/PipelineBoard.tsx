'use client'
import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import Link from 'next/link'
import { LayoutList, Zap } from 'lucide-react'

type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  service: string | null
  value: number | null
  gclid: string | null
  status: string
  createdAt: string | Date
  company: { name: string; color: string } | null
}

const COLUMNS: { id: string; label: string; color: string; headerCls: string; dotCls: string }[] = [
  { id: 'new',       label: 'New',       color: '#3b82f6', headerCls: 'bg-blue-50 border-blue-200',    dotCls: 'bg-blue-400' },
  { id: 'contacted', label: 'Contacted', color: '#eab308', headerCls: 'bg-yellow-50 border-yellow-200', dotCls: 'bg-yellow-400' },
  { id: 'qualified', label: 'Qualified', color: '#a855f7', headerCls: 'bg-purple-50 border-purple-200', dotCls: 'bg-purple-400' },
  { id: 'won',       label: 'Won',       color: '#22c55e', headerCls: 'bg-green-50 border-green-200',   dotCls: 'bg-green-400' },
  { id: 'lost',      label: 'Lost',      color: '#ef4444', headerCls: 'bg-red-50 border-red-200',       dotCls: 'bg-red-400' },
  { id: 'junk',      label: 'Junk',      color: '#94a3b8', headerCls: 'bg-slate-50 border-slate-200',   dotCls: 'bg-slate-400' },
]

const AUTO_PUSH_STATUSES = new Set(['qualified', 'won'])

function groupByStatus(leads: Lead[]): Record<string, Lead[]> {
  const groups: Record<string, Lead[]> = {}
  for (const col of COLUMNS) groups[col.id] = []
  for (const lead of leads) {
    ;(groups[lead.status] ?? groups.new).push(lead)
  }
  return groups
}

function LeadCard({ lead, index }: { lead: Lead; index: number }) {
  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg border p-3 mb-2 select-none transition-shadow ${
            snapshot.isDragging ? 'shadow-lg border-indigo-300 rotate-1' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <Link
            href={`/leads/${lead.id}`}
            className="block text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors leading-tight mb-1"
            onClick={(e) => snapshot.isDragging && e.preventDefault()}
          >
            {lead.name}
          </Link>
          {lead.company && (
            <span
              className="inline-block text-xs font-medium px-1.5 py-0.5 rounded-full mb-1.5"
              style={{ backgroundColor: lead.company.color + '20', color: lead.company.color }}
            >
              {lead.company.name}
            </span>
          )}
          <div className="space-y-0.5">
            {lead.value != null && (
              <p className="text-xs font-semibold text-slate-700">${lead.value.toLocaleString()}</p>
            )}
            {lead.service && (
              <p className="text-xs text-slate-500 truncate">{lead.service}</p>
            )}
            {lead.email && (
              <p className="text-xs text-slate-400 truncate">{lead.email}</p>
            )}
          </div>
          {lead.gclid && (
            <div className="mt-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-amber-500 font-medium">gclid</span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

export default function PipelineBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [columns, setColumns] = useState<Record<string, Lead[]>>(
    () => groupByStatus(initialLeads)
  )
  const [pendingPush, setPendingPush] = useState<Set<string>>(new Set())

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return

    const sourceCol = [...columns[source.droppableId]]
    const destCol = [...columns[destination.droppableId]]
    const [moved] = sourceCol.splice(source.index, 1)
    const updated: Lead = { ...moved, status: destination.droppableId }
    destCol.splice(destination.index, 0, updated)

    setColumns((prev) => ({
      ...prev,
      [source.droppableId]: sourceCol,
      [destination.droppableId]: destCol,
    }))

    const isAutoPush = AUTO_PUSH_STATUSES.has(destination.droppableId) && moved.gclid
    if (isAutoPush) setPendingPush((s) => new Set(s).add(draggableId))

    try {
      await fetch(`/api/leads/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destination.droppableId }),
      })
    } catch {
      // Revert on failure
      setColumns((prev) => ({
        ...prev,
        [source.droppableId]: [...prev[source.droppableId], moved],
        [destination.droppableId]: prev[destination.droppableId].filter((l) => l.id !== draggableId),
      }))
    } finally {
      if (isAutoPush) setPendingPush((s) => { const n = new Set(s); n.delete(draggableId); return n })
    }
  }

  const totalValue = Object.values(columns).flat().reduce((sum, l) => sum + (l.value ?? 0), 0)
  const wonValue = columns.won.reduce((sum, l) => sum + (l.value ?? 0), 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {Object.values(columns).flat().length} leads
            {totalValue > 0 && ` · $${totalValue.toLocaleString()} total`}
            {wonValue > 0 && ` · $${wonValue.toLocaleString()} won`}
          </p>
        </div>
        <Link
          href="/leads"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <LayoutList className="w-4 h-4" />
          List view
        </Link>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {COLUMNS.map((col) => {
            const leads = columns[col.id] ?? []
            const colValue = leads.reduce((sum, l) => sum + (l.value ?? 0), 0)
            return (
              <div key={col.id} className="flex-shrink-0 w-64 flex flex-col">
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-x border-t ${col.headerCls} mb-0`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotCls}`} />
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{col.label}</span>
                    <span className="text-xs text-slate-500 font-medium">{leads.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {colValue > 0 && (
                      <span className="text-xs text-slate-500">${colValue.toLocaleString()}</span>
                    )}
                    {AUTO_PUSH_STATUSES.has(col.id) && (
                      <Zap className="w-3 h-3 text-amber-400" />
                    )}
                  </div>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 rounded-b-lg border border-t-0 transition-colors ${col.headerCls} ${
                        snapshot.isDraggingOver ? 'bg-opacity-80' : ''
                      }`}
                    >
                      {leads.map((lead, index) => (
                        <div key={lead.id} className="relative">
                          <LeadCard lead={{ ...lead, status: col.id }} index={index} />
                          {pendingPush.has(lead.id) && (
                            <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                          )}
                        </div>
                      ))}
                      {provided.placeholder}
                      {leads.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-center text-xs text-slate-400 py-6">Drop here</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      <p className="mt-3 text-xs text-slate-400 flex items-center gap-1">
        <Zap className="w-3 h-3 text-amber-400" />
        Qualified and Won automatically push offline conversions to Google Ads (if gclid present and conversion action IDs configured in Settings)
      </p>
    </div>
  )
}
