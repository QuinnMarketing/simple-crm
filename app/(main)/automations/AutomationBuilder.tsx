'use client'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow, Background, BackgroundVariant, Controls, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath, MarkerType, useReactFlow, ReactFlowProvider,
} from '@xyflow/react'
import type { Node, Edge, NodeProps, EdgeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Plus, Trash2, ChevronLeft, Save, Loader2, Mail, Clock, GitBranch,
  Zap, Edit2, Bell, RefreshCw, Webhook, ToggleLeft, ToggleRight, Check,
  Play, X, History, CheckCircle2, XCircle, Pause, AlertCircle, CalendarPlus,
} from 'lucide-react'
import type {
  AutomationDefinition, BodyStep, ActionStep, ConditionStep, DelayStep,
  TriggerType, ActionType, ConditionOperator, ConditionRule,
} from '@/lib/automation-types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS: { value: TriggerType; label: string; desc: string }[] = [
  { value: 'lead_created',          label: 'New lead created',             desc: 'Fires immediately when a lead is created' },
  { value: 'lead_status_changed',   label: 'Lead status changed',          desc: 'When a lead\'s status is updated' },
  { value: 'lead_field_changed',    label: 'Lead field changed',           desc: 'When a specific lead field is updated' },
  { value: 'appointment_created',   label: 'Appointment created',          desc: 'When a new appointment is booked' },
  { value: 'quote_created',         label: 'Quote created',                desc: 'When a new quote is generated' },
  { value: 'manual',                label: 'Manual trigger',               desc: 'Run manually from the automation page' },
  { value: 'relative_days',         label: 'X days after lead created',    desc: 'Runs via daily cron job' },
  { value: 'idle_lead',             label: 'Lead idle for X days',         desc: 'No activity for a set number of days' },
  { value: 'pending_quote',         label: 'Quote unanswered for X days',  desc: 'Quote in "Sent" status past a deadline' },
  { value: 'appointment_reminder',  label: 'Before appointment',           desc: 'Runs X hours before an appointment' },
]

const ACTION_OPTIONS: { value: ActionType; label: string; icon: React.ReactNode }[] = [
  { value: 'send_email',         label: 'Send email to lead',   icon: <Mail className="w-4 h-4" /> },
  { value: 'notify_team',        label: 'Notify team member',   icon: <Bell className="w-4 h-4" /> },
  { value: 'create_appointment', label: 'Create appointment',   icon: <CalendarPlus className="w-4 h-4" /> },
  { value: 'update_lead',        label: 'Update lead field',    icon: <RefreshCw className="w-4 h-4" /> },
  { value: 'add_note',           label: 'Add note to lead',     icon: <Edit2 className="w-4 h-4" /> },
  { value: 'send_webhook',       label: 'Send webhook',         icon: <Webhook className="w-4 h-4" /> },
]

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'won', 'lost']
const LEAD_FIELDS = ['status', 'source', 'service', 'notes', 'address', 'nextStep', 'phone', 'email']
const CONDITION_FIELDS = ['status', 'source', 'service', 'email', 'phone', 'address', 'value', 'notes']
const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals',       label: 'equals' },
  { value: 'not_equals',   label: 'does not equal' },
  { value: 'contains',     label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with',  label: 'starts with' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than',    label: 'is less than' },
  { value: 'is_empty',     label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]
const VARS = ['{{name}}', '{{email}}', '{{phone}}', '{{service}}', '{{source}}', '{{status}}', '{{date}}', '{{time}}', '{{location}}']

const EMPTY_DEF: AutomationDefinition = {
  trigger: { triggerType: 'lead_created', config: {} },
  steps: [],
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white'
const lbl = 'block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide'

// ─── Summary helpers ───────────────────────────────────────────────────────────

function triggerSummary(def: AutomationDefinition): string {
  const cfg = def.trigger.config
  switch (def.trigger.triggerType) {
    case 'lead_status_changed': return cfg.toStatus ? `Status → ${cfg.toStatus}` : 'Any status change'
    case 'lead_field_changed': return cfg.field ? `Field: ${cfg.field}` : 'Any field'
    case 'idle_lead': return `${cfg.days ?? 7} days idle`
    case 'pending_quote': return `${cfg.days ?? 3} days unanswered`
    case 'relative_days': return `${cfg.days ?? 7} days after creation`
    case 'appointment_reminder': return `${cfg.hoursBeforeAppointment ?? 24}h before`
    default: return ''
  }
}

function actionLabel(type: ActionType): string {
  return ACTION_OPTIONS.find(o => o.value === type)?.label ?? type
}

function actionSummary(step: ActionStep): string {
  const c = step.config
  switch (step.actionType) {
    case 'send_email': case 'notify_team': return c.subject ?? 'No subject'
    case 'update_lead': return c.field ? `${c.field} = ${c.value ?? '?'}` : 'No field'
    case 'add_note': return c.content ? c.content.slice(0, 50) : 'Empty note'
    case 'send_webhook': return c.url ?? 'No URL'
    case 'create_appointment': return c.appointmentTitle ?? 'Follow up: {{name}}'
    default: return ''
  }
}

function delaySummary(s: DelayStep): string { return `Wait ${s.duration} ${s.unit}` }

function conditionSummary(s: ConditionStep): string {
  const r = s.conditions[0]
  if (!r) return 'No condition'
  const label = OPERATORS.find(o => o.value === r.operator)?.label ?? r.operator
  return `IF ${r.field} ${label} "${r.value}"`
}

// ─── VarChips ──────────────────────────────────────────────────────────────────
function VarChips({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {VARS.map(v => (
        <button key={v} type="button" onClick={() => onInsert(v)}
          className="text-xs font-mono text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors">
          {v}
        </button>
      ))}
    </div>
  )
}

// ─── Node data types ───────────────────────────────────────────────────────────
type TriggerNodeData = { def: AutomationDefinition; isSelected: boolean; onSelect: () => void }
type StepNodeData = { step: BodyStep; isSelected: boolean; onSelect: () => void; onDelete: () => void }
type EndNodeData = Record<string, never>
type AddEdgeData = { insertAfterIdx: number; addStep: (idx: number, type: 'action' | 'delay' | 'condition') => void }

// ─── Step type picker ──────────────────────────────────────────────────────────
function StepTypeMenu({ onPick }: { onPick: (type: 'action' | 'delay' | 'condition') => void }) {
  const items = [
    { type: 'action' as const,    icon: <Mail className="w-4 h-4 text-blue-500" />,    label: 'Action',    desc: 'Send email, update lead, etc.' },
    { type: 'delay' as const,     icon: <Clock className="w-4 h-4 text-amber-500" />,  label: 'Delay',     desc: 'Wait before continuing' },
    { type: 'condition' as const, icon: <GitBranch className="w-4 h-4 text-sky-500" />, label: 'Condition', desc: 'Branch on a lead field' },
  ]
  return (
    <div className="w-52 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 nodrag nopan" onMouseDown={e => e.stopPropagation()}>
      {items.map(item => (
        <button key={item.type} onMouseDown={e => { e.stopPropagation(); onPick(item.type) }}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">{item.icon}</div>
          <div>
            <p className="text-xs font-semibold text-slate-900">{item.label}</p>
            <p className="text-xs text-slate-400">{item.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Custom Edge: shows "+" button in the middle ───────────────────────────────
function AddButtonEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }: EdgeProps) {
  const edgeData = data as AddEdgeData
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8 })
  const [showMenu, setShowMenu] = useState(false)

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style ?? { stroke: '#94a3b8', strokeWidth: 1.5 }} />
      <EdgeLabelRenderer>
        <div
          className="absolute nodrag nopan"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
        >
          <button
            onMouseDown={e => { e.stopPropagation(); setShowMenu(v => !v) }}
            className="w-6 h-6 bg-white border-2 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-full flex items-center justify-center shadow-sm transition-colors"
          >
            <Plus className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
          </button>
          {showMenu && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
              <StepTypeMenu onPick={type => { edgeData.addStep(edgeData.insertAfterIdx, type); setShowMenu(false) }} />
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { addEdge: AddButtonEdge }

// ─── Base node shell ───────────────────────────────────────────────────────────
function NodeShell({ accent, iconBg, iconColor, icon, typeLabel, title, summary, isSelected, onSelect, onDelete, badge }: {
  accent: string; iconBg: string; iconColor: string; icon: React.ReactNode
  typeLabel: string; title: string; summary?: string
  isSelected: boolean; onSelect: () => void; onDelete?: () => void; badge?: string
}) {
  return (
    <div
      onMouseDown={e => { e.stopPropagation(); onSelect() }}
      style={isSelected ? { boxShadow: '0 0 0 2.5px #4f46e5, 0 8px 28px rgba(79,70,229,0.22)' } : undefined}
      className={`w-72 bg-white rounded-2xl cursor-pointer select-none transition-all duration-150 overflow-hidden ${isSelected ? 'scale-[1.02]' : 'border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/80'}`}
    >
      {/* Colored top strip */}
      <div className={`h-1.5 w-full ${accent}`} />

      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{typeLabel}</p>
          <p className="text-sm font-bold text-slate-800 truncate leading-tight">{title}</p>
        </div>
        {badge && (
          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums">{badge}</span>
        )}
        {isSelected && onDelete && (
          <button
            onMouseDown={e => { e.stopPropagation(); onDelete() }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {summary && (
        <div className="px-4 pb-3.5 -mt-1">
          <p className="text-xs text-slate-400 truncate">{summary}</p>
        </div>
      )}
    </div>
  )
}

const HANDLE_CLS = '!bg-slate-300 !w-2.5 !h-2.5 !border-2 !border-white !shadow-sm'

// ─── Custom node components ────────────────────────────────────────────────────

function TriggerNodeComp({ data }: NodeProps) {
  const d = data as TriggerNodeData
  const opt = TRIGGER_OPTIONS.find(o => o.value === d.def.trigger.triggerType)
  const sum = triggerSummary(d.def)
  return (
    <>
      <NodeShell
        accent="bg-violet-500" iconBg="bg-violet-100" iconColor="text-violet-600"
        icon={<Zap className="w-4.5 h-4.5" />}
        typeLabel="Trigger" title={opt?.label ?? d.def.trigger.triggerType}
        summary={sum || undefined}
        isSelected={d.isSelected} onSelect={d.onSelect}
      />
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLS} />
    </>
  )
}

function ActionNodeComp({ data }: NodeProps) {
  const d = data as StepNodeData
  const step = d.step as ActionStep
  const iconMap: Partial<Record<ActionType, React.ReactNode>> = {
    send_email: <Mail className="w-4 h-4" />,
    notify_team: <Bell className="w-4 h-4" />,
    create_appointment: <CalendarPlus className="w-4 h-4" />,
    update_lead: <RefreshCw className="w-4 h-4" />,
    add_note: <Edit2 className="w-4 h-4" />,
    send_webhook: <Webhook className="w-4 h-4" />,
  }
  return (
    <>
      <Handle type="target" position={Position.Top} className={HANDLE_CLS} />
      <NodeShell
        accent="bg-sky-500" iconBg="bg-sky-100" iconColor="text-sky-600"
        icon={iconMap[step.actionType] ?? <Zap className="w-4 h-4" />}
        typeLabel="Action" title={actionLabel(step.actionType)}
        summary={actionSummary(step) || undefined}
        isSelected={d.isSelected} onSelect={d.onSelect} onDelete={d.onDelete}
      />
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLS} />
    </>
  )
}

function DelayNodeComp({ data }: NodeProps) {
  const d = data as StepNodeData
  const step = d.step as DelayStep
  return (
    <>
      <Handle type="target" position={Position.Top} className={HANDLE_CLS} />
      <NodeShell
        accent="bg-amber-400" iconBg="bg-amber-100" iconColor="text-amber-600"
        icon={<Clock className="w-4 h-4" />}
        typeLabel="Delay" title={delaySummary(step)}
        isSelected={d.isSelected} onSelect={d.onSelect} onDelete={d.onDelete}
      />
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLS} />
    </>
  )
}

function ConditionNodeComp({ data }: NodeProps) {
  const d = data as StepNodeData
  const step = d.step as ConditionStep
  return (
    <>
      <Handle type="target" position={Position.Top} className={HANDLE_CLS} />
      <NodeShell
        accent="bg-emerald-500" iconBg="bg-emerald-100" iconColor="text-emerald-600"
        icon={<GitBranch className="w-4 h-4" />}
        typeLabel="Condition" title={step.label ?? conditionSummary(step)}
        summary={step.label ? conditionSummary(step) : undefined}
        isSelected={d.isSelected} onSelect={d.onSelect} onDelete={d.onDelete}
        badge={`${step.ifTrue.length}✓ / ${step.ifFalse.length}✗`}
      />
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLS} />
    </>
  )
}

function EndNodeComp() {
  return (
    <>
      <Handle type="target" position={Position.Top} className={HANDLE_CLS} />
      <div className="flex items-center gap-2 bg-white border-2 border-dashed border-slate-200 rounded-2xl px-5 py-2.5 text-xs font-semibold text-slate-400 select-none uppercase tracking-widest">
        <Check className="w-3.5 h-3.5" /> End
      </div>
    </>
  )
}

const nodeTypes = {
  triggerNode: TriggerNodeComp,
  actionNode: ActionNodeComp,
  delayNode: DelayNodeComp,
  conditionNode: ConditionNodeComp,
  endNode: EndNodeComp,
}

// ─── Flow layout builder ───────────────────────────────────────────────────────

const NODE_W = 288
const STEP_H = 110

function buildFlowData(
  def: AutomationDefinition,
  selectedId: string | null,
  addStep: (idx: number, type: 'action' | 'delay' | 'condition') => void,
  removeStep: (id: string) => void,
  setSelectedId: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let y = 0
  const cx = 0

  nodes.push({
    id: '__trigger__', type: 'triggerNode',
    position: { x: cx - NODE_W / 2, y },
    data: {
      def,
      isSelected: selectedId === '__trigger__',
      onSelect: () => setSelectedId('__trigger__'),
    } as TriggerNodeData,
    draggable: false,
  })
  y += STEP_H

  let prevId = '__trigger__'

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i]
    const typeMap: Record<string, string> = { action: 'actionNode', delay: 'delayNode', condition: 'conditionNode' }

    nodes.push({
      id: step.id,
      type: typeMap[step.type] ?? 'actionNode',
      position: { x: cx - NODE_W / 2, y },
      data: {
        step,
        isSelected: selectedId === step.id,
        onSelect: () => setSelectedId(step.id),
        onDelete: () => removeStep(step.id),
      } as StepNodeData,
      draggable: false,
    })

    edges.push({
      id: `e-${prevId}-${step.id}`,
      source: prevId, target: step.id,
      type: 'addEdge',
      data: { insertAfterIdx: i - 1, addStep } as AddEdgeData,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })

    y += STEP_H
    prevId = step.id
  }

  nodes.push({
    id: '__end__', type: 'endNode',
    position: { x: cx - NODE_W / 2, y },
    data: {} as EndNodeData,
    draggable: false,
  })

  edges.push({
    id: `e-${prevId}-__end__`,
    source: prevId, target: '__end__',
    type: 'addEdge',
    data: { insertAfterIdx: def.steps.length - 1, addStep } as AddEdgeData,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
    style: { stroke: '#94a3b8', strokeWidth: 1.5 },
  })

  return { nodes, edges }
}

// ─── Config Panel ──────────────────────────────────────────────────────────────

function TriggerConfigForm({ def, onChange }: { def: AutomationDefinition; onChange: (d: AutomationDefinition) => void }) {
  const { trigger } = def
  const cfg = trigger.config
  const setCfg = (patch: object) => onChange({ ...def, trigger: { ...trigger, config: { ...cfg, ...patch } } })

  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Trigger event</label>
        <select value={trigger.triggerType}
          onChange={e => onChange({ ...def, trigger: { triggerType: e.target.value as TriggerType, config: {} } })}
          className={inp}>
          {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs text-slate-400 mt-1">{TRIGGER_OPTIONS.find(o => o.value === trigger.triggerType)?.desc}</p>
      </div>

      {trigger.triggerType === 'lead_status_changed' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>From (optional)</label>
            <select value={cfg.fromStatus ?? ''} onChange={e => setCfg({ fromStatus: e.target.value || undefined })} className={inp}>
              <option value="">Any</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>To status</label>
            <select value={cfg.toStatus ?? ''} onChange={e => setCfg({ toStatus: e.target.value || undefined })} className={inp}>
              <option value="">Any</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {trigger.triggerType === 'lead_field_changed' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Field</label>
            <select value={cfg.field ?? ''} onChange={e => setCfg({ field: e.target.value })} className={inp}>
              <option value="">Select</option>
              {LEAD_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>To value</label>
            <input type="text" value={cfg.toValue ?? ''} onChange={e => setCfg({ toValue: e.target.value || undefined })} className={inp} placeholder="Any" />
          </div>
        </div>
      )}

      {(trigger.triggerType === 'relative_days' || trigger.triggerType === 'idle_lead' || trigger.triggerType === 'pending_quote') && (
        <div>
          <label className={lbl}>Days</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} value={cfg.days ?? 7} onChange={e => setCfg({ days: parseInt(e.target.value) || 7 })} className={`${inp} w-24`} />
            <span className="text-sm text-slate-500">days</span>
          </div>
        </div>
      )}

      {trigger.triggerType === 'idle_lead' && (
        <div>
          <label className={lbl}>Check statuses</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {STATUS_OPTIONS.map(s => {
              const checked = (cfg.statuses ?? ['new', 'contacted', 'qualified']).includes(s)
              return (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={e => {
                    const cur = cfg.statuses ?? ['new', 'contacted', 'qualified']
                    setCfg({ statuses: e.target.checked ? [...cur, s] : cur.filter((x: string) => x !== s) })
                  }} className="rounded border-slate-300" />
                  <span className="capitalize">{s}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {trigger.triggerType === 'appointment_reminder' && (
        <div>
          <label className={lbl}>Hours before appointment</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={72} value={cfg.hoursBeforeAppointment ?? 24} onChange={e => setCfg({ hoursBeforeAppointment: parseInt(e.target.value) || 24 })} className={`${inp} w-24`} />
            <span className="text-sm text-slate-500">hours before</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionConfigForm({ step, onChange }: { step: ActionStep; onChange: (s: ActionStep) => void }) {
  const cfg = step.config
  const set = (patch: object) => onChange({ ...step, config: { ...cfg, ...patch } })
  const ins = (field: 'subject' | 'body' | 'content', v: string) => set({ [field]: ((cfg[field] as string) ?? '') + v })

  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Label (optional)</label>
        <input type="text" value={step.label ?? ''} onChange={e => onChange({ ...step, label: e.target.value || undefined })} className={inp} placeholder="Step name" />
      </div>

      <div>
        <label className={lbl}>Action type</label>
        <select value={step.actionType} onChange={e => onChange({ ...step, actionType: e.target.value as ActionType, config: {} })} className={inp}>
          {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {(step.actionType === 'send_email' || step.actionType === 'notify_team') && (
        <>
          <div>
            <label className={lbl}>{step.actionType === 'send_email' ? 'To address' : 'Team email'}</label>
            <input type="text" value={cfg.to ?? (step.actionType === 'send_email' ? '{{email}}' : '')} onChange={e => set({ to: e.target.value })} className={inp} placeholder={step.actionType === 'send_email' ? '{{email}}' : 'team@yourcompany.com'} />
          </div>
          <div>
            <label className={lbl}>Subject</label>
            <input type="text" value={cfg.subject ?? ''} onChange={e => set({ subject: e.target.value })} className={inp} />
            <VarChips onInsert={v => ins('subject', v)} />
          </div>
          <div>
            <label className={lbl}>Body (HTML or plain text)</label>
            <textarea rows={6} value={cfg.body ?? ''} onChange={e => set({ body: e.target.value })} className={`${inp} resize-none font-mono text-xs`} />
            <VarChips onInsert={v => ins('body', v)} />
          </div>
        </>
      )}

      {step.actionType === 'update_lead' && (
        <>
          <div>
            <label className={lbl}>Field to update</label>
            <select value={cfg.field ?? ''} onChange={e => set({ field: e.target.value })} className={inp}>
              <option value="">Select field</option>
              {LEAD_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>New value</label>
            <input type="text" value={cfg.value ?? ''} onChange={e => set({ value: e.target.value })} className={inp} placeholder="Value or {{variable}}" />
            {cfg.field === 'status' && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => set({ value: s })}
                    className="text-xs bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 px-2 py-0.5 rounded capitalize">{s}</button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {step.actionType === 'add_note' && (
        <div>
          <label className={lbl}>Note content</label>
          <textarea rows={3} value={cfg.content ?? ''} onChange={e => set({ content: e.target.value })} className={`${inp} resize-none`} />
          <VarChips onInsert={v => ins('content', v)} />
        </div>
      )}

      {step.actionType === 'send_webhook' && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={lbl}>Method</label>
              <select value={cfg.method ?? 'POST'} onChange={e => set({ method: e.target.value })} className={inp}>
                {['GET', 'POST', 'PUT', 'PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>URL</label>
              <input type="text" value={cfg.url ?? ''} onChange={e => set({ url: e.target.value })} className={inp} placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className={lbl}>Headers (JSON)</label>
            <input type="text" value={cfg.headers ?? ''} onChange={e => set({ headers: e.target.value })} className={`${inp} font-mono text-xs`} placeholder='{"Authorization":"Bearer token"}' />
          </div>
          <div>
            <label className={lbl}>Body template (JSON)</label>
            <textarea rows={3} value={cfg.webhookBody ?? ''} onChange={e => set({ webhookBody: e.target.value })} className={`${inp} resize-none font-mono text-xs`} />
          </div>
        </>
      )}

      {step.actionType === 'create_appointment' && (
        <>
          <div>
            <label className={lbl}>Appointment title</label>
            <input type="text" value={cfg.appointmentTitle ?? 'Follow up: {{name}}'} onChange={e => set({ appointmentTitle: e.target.value })} className={inp} placeholder="Follow up: {{name}}" />
            <VarChips onInsert={v => set({ appointmentTitle: (cfg.appointmentTitle ?? 'Follow up: {{name}}') + v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Days from now</label>
              <input type="number" min={0} max={365} value={cfg.daysFromNow ?? 1} onChange={e => set({ daysFromNow: Math.max(0, parseInt(e.target.value) || 1) })} className={inp} />
            </div>
            <div>
              <label className={lbl}>Hour of day</label>
              <select value={cfg.hour ?? 9} onChange={e => set({ hour: parseInt(e.target.value) })} className={inp}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12:00 am' : i < 12 ? `${i}:00 am` : i === 12 ? '12:00 pm' : `${i - 12}:00 pm`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Duration (mins)</label>
              <input type="number" min={15} max={480} step={15} value={cfg.duration ?? 60} onChange={e => set({ duration: Math.max(15, parseInt(e.target.value) || 60) })} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Notes (optional)</label>
            <textarea rows={2} value={cfg.appointmentNotes ?? ''} onChange={e => set({ appointmentNotes: e.target.value })} className={`${inp} resize-none`} placeholder="Optional appointment notes" />
          </div>
        </>
      )}
    </div>
  )
}

function DelayConfigForm({ step, onChange }: { step: DelayStep; onChange: (s: DelayStep) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Label (optional)</label>
        <input type="text" value={step.label ?? ''} onChange={e => onChange({ ...step, label: e.target.value || undefined })} className={inp} placeholder="Step name" />
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label className={lbl}>Duration</label>
          <input type="number" min={1} max={9999} value={step.duration}
            onChange={e => onChange({ ...step, duration: Math.max(1, parseInt(e.target.value) || 1) })}
            className={`${inp} w-24`} />
        </div>
        <div>
          <label className={lbl}>Unit</label>
          <select value={step.unit} onChange={e => onChange({ ...step, unit: e.target.value as DelayStep['unit'] })} className={inp}>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function BranchActionList({ label, color, steps, onChange }: {
  label: string; color: string; steps: ActionStep[]; onChange: (s: ActionStep[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${color}`}>{label}</p>
      {steps.map(s => (
        <div key={s.id} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
            onClick={() => setEditingId(editingId === s.id ? null : s.id)}>
            <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <p className="text-xs font-medium text-slate-700 flex-1 truncate">{actionLabel(s.actionType)}: {actionSummary(s)}</p>
            <button onMouseDown={e => { e.stopPropagation(); onChange(steps.filter(x => x.id !== s.id)) }}
              className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
          </div>
          {editingId === s.id && (
            <div className="px-3 pb-3 border-t border-slate-100 bg-slate-50/50">
              <ActionConfigForm step={s} onChange={updated => onChange(steps.map(x => x.id === s.id ? updated : x))} />
            </div>
          )}
        </div>
      ))}
      <button
        onMouseDown={() => {
          const ns: ActionStep = { id: uid(), type: 'action', actionType: 'send_email', config: { to: '{{email}}' } }
          onChange([...steps, ns])
          setEditingId(ns.id)
        }}
        className="w-full flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
      >
        <Plus className="w-3 h-3" /> Add action
      </button>
    </div>
  )
}

function ConditionConfigForm({ step, onChange }: { step: ConditionStep; onChange: (s: ConditionStep) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Label (optional)</label>
        <input type="text" value={step.label ?? ''} onChange={e => onChange({ ...step, label: e.target.value || undefined })} className={inp} placeholder="Step name" />
      </div>

      <div>
        <label className={lbl}>Logic</label>
        <select value={step.logicOperator} onChange={e => onChange({ ...step, logicOperator: e.target.value as 'AND' | 'OR' })} className={inp}>
          <option value="AND">All conditions must match (AND)</option>
          <option value="OR">Any condition can match (OR)</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className={lbl}>Conditions</label>
        {step.conditions.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <select value={rule.field} onChange={e => onChange({ ...step, conditions: step.conditions.map((r, i) => i === idx ? { ...r, field: e.target.value } : r) })}
              className={`${inp} flex-1`}>
              {CONDITION_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={rule.operator} onChange={e => onChange({ ...step, conditions: step.conditions.map((r, i) => i === idx ? { ...r, operator: e.target.value as ConditionOperator } : r) })}
              className={`${inp} flex-1`}>
              {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
              <input type="text" value={rule.value} onChange={e => onChange({ ...step, conditions: step.conditions.map((r, i) => i === idx ? { ...r, value: e.target.value } : r) })}
                className={`${inp} flex-1`} placeholder="Value" />
            )}
            <button onClick={() => onChange({ ...step, conditions: step.conditions.filter((_, i) => i !== idx) })}
              className="text-slate-300 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button onClick={() => onChange({ ...step, conditions: [...step.conditions, { field: 'status', operator: 'equals', value: '' }] })}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add condition
        </button>
      </div>

      <div className="space-y-3 pt-2 border-t border-slate-100">
        <BranchActionList label="✅ YES branch" color="bg-green-100 text-green-700"
          steps={step.ifTrue} onChange={s => onChange({ ...step, ifTrue: s })} />
        <BranchActionList label="❌ NO branch" color="bg-red-100 text-red-700"
          steps={step.ifFalse} onChange={s => onChange({ ...step, ifFalse: s })} />
      </div>
    </div>
  )
}

function ConfigPanel({ def, selectedId, onDefChange, onUpdateStep }: {
  def: AutomationDefinition
  selectedId: string | null
  onDefChange: (d: AutomationDefinition) => void
  onUpdateStep: (id: string, updated: BodyStep) => void
}) {
  if (!selectedId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-slate-400">
        <Zap className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm font-medium text-slate-500">Select a node to configure</p>
        <p className="text-xs mt-1">Click any node on the canvas</p>
      </div>
    )
  }

  const PANEL_HEADERS: Record<string, { accent: string; iconBg: string; iconColor: string; icon: React.ReactNode; label: string }> = {
    __trigger__: { accent: 'bg-violet-500', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', icon: <Zap className="w-4 h-4" />, label: 'Trigger' },
    action:      { accent: 'bg-sky-500',    iconBg: 'bg-sky-100',    iconColor: 'text-sky-600',    icon: <Mail className="w-4 h-4" />,      label: 'Action' },
    delay:       { accent: 'bg-amber-400',  iconBg: 'bg-amber-100',  iconColor: 'text-amber-600',  icon: <Clock className="w-4 h-4" />,     label: 'Delay' },
    condition:   { accent: 'bg-emerald-500',iconBg: 'bg-emerald-100',iconColor: 'text-emerald-600',icon: <GitBranch className="w-4 h-4" />, label: 'Condition' },
  }

  if (selectedId === '__trigger__') {
    const h = PANEL_HEADERS.__trigger__
    return (
      <div>
        <div className={`${h.accent} px-4 py-3 flex items-center gap-2.5`}>
          <div className={`w-7 h-7 rounded-lg ${h.iconBg} flex items-center justify-center`}>
            <span className={h.iconColor}>{h.icon}</span>
          </div>
          <p className="text-sm font-semibold text-white">Configure Trigger</p>
        </div>
        <div className="p-4">
          <TriggerConfigForm def={def} onChange={onDefChange} />
        </div>
      </div>
    )
  }

  const step = def.steps.find(s => s.id === selectedId)
  if (!step) return null

  const h = PANEL_HEADERS[step.type] ?? PANEL_HEADERS.action
  return (
    <div>
      <div className={`${h.accent} px-4 py-3 flex items-center gap-2.5`}>
        <div className={`w-7 h-7 rounded-lg ${h.iconBg} flex items-center justify-center`}>
          <span className={h.iconColor}>{h.icon}</span>
        </div>
        <p className="text-sm font-semibold text-white">Configure {h.label}</p>
      </div>
      <div className="p-4">
        {step.type === 'action' && (
          <ActionConfigForm step={step as ActionStep} onChange={s => onUpdateStep(step.id, s)} />
        )}
        {step.type === 'delay' && (
          <DelayConfigForm step={step as DelayStep} onChange={s => onUpdateStep(step.id, s)} />
        )}
        {step.type === 'condition' && (
          <ConditionConfigForm step={step as ConditionStep} onChange={s => onUpdateStep(step.id, s)} />
        )}
      </div>
    </div>
  )
}

// ─── Run history panel ─────────────────────────────────────────────────────────

type RunLog = { id: string; stepId: string; stepType: string; label?: string; status: string; output?: string; error?: string; executedAt: string }
type Run = { id: string; leadId?: string; status: string; startedAt: string; completedAt?: string; stepLogs: RunLog[] }

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  running: <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />,
  waiting: <Pause className="w-4 h-4 text-blue-500" />,
}

function RunHistoryPanel({ automationId }: { automationId: string }) {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/automations/${automationId}/runs`)
      .then(r => r.json())
      .then(data => { setRuns(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [automationId])

  if (loading) return <div className="flex justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (runs.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <History className="w-8 h-8 mb-3 opacity-30" />
      <p className="text-sm font-medium text-slate-500">No runs yet</p>
      <p className="text-xs mt-1">Runs appear here after the automation fires</p>
    </div>
  )

  return (
    <div className="p-4 space-y-2 overflow-y-auto max-h-full">
      {runs.map(run => (
        <div key={run.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpanded(expanded === run.id ? null : run.id)}>
            {STATUS_ICONS[run.status] ?? <AlertCircle className="w-4 h-4 text-slate-400" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 capitalize">{run.status}</p>
              <p className="text-xs text-slate-400">{run.leadId ? `Lead ${run.leadId.slice(-6)}` : 'No lead'} · {new Date(run.startedAt).toLocaleString()}</p>
            </div>
            <span className="text-xs text-slate-400">{run.stepLogs.length} steps</span>
          </div>
          {expanded === run.id && run.stepLogs.length > 0 && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {run.stepLogs.map(log => (
                <div key={log.id} className="px-4 py-2.5 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    {log.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      : log.status === 'failed' ? <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    <span className="text-xs font-medium text-slate-700">{log.label ?? log.stepType}</span>
                    <span className="text-xs text-slate-400 ml-auto">{new Date(log.executedAt).toLocaleTimeString()}</span>
                  </div>
                  {log.output && <p className="text-xs text-slate-500 mt-1 ml-5">{log.output}</p>}
                  {log.error && <p className="text-xs text-red-500 mt-1 ml-5">{log.error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Test run modal ────────────────────────────────────────────────────────────

function TestRunModal({ automationId, onClose }: { automationId: string; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [leads, setLeads] = useState<{ id: string; name: string; email?: string }[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingLeads(true)
    fetch(`/api/leads?limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then(r => r.json())
      .then(data => { setLeads(Array.isArray(data) ? data : (data.leads ?? [])); setLoadingLeads(false) })
      .catch(() => setLoadingLeads(false))
  }, [search])

  async function runTest(leadId: string) {
    setRunning(true); setResult(null); setError(null)
    try {
      const res = await fetch(`/api/automations/${automationId}/test-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? `Error ${res.status}`)
      else setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Test Run</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-center gap-2 mb-4">
              {result.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
              <p className="font-semibold text-slate-900 capitalize">Run {result.status}</p>
            </div>
            <div className="space-y-2">
              {result.stepLogs.map(log => (
                <div key={log.id} className={`rounded-lg px-3 py-2.5 text-sm ${log.status === 'completed' ? 'bg-green-50 border border-green-100' : log.status === 'failed' ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    {log.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : log.status === 'failed' ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="font-medium text-slate-900">{log.label ?? log.stepType}</span>
                  </div>
                  {log.output && <p className="text-xs text-slate-600 mt-1 ml-5">{log.output}</p>}
                  {log.error && <p className="text-xs text-red-600 mt-1 ml-5">{log.error}</p>}
                </div>
              ))}
            </div>
            <button onClick={() => setResult(null)} className="mt-4 text-sm text-indigo-600 hover:text-indigo-700">← Run another test</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-sm text-slate-600 mb-3">Pick a lead to run this automation against:</p>
            <input
              type="text"
              placeholder="Search leads…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inp} mb-3`}
              autoFocus
            />
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            {loadingLeads ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No leads found</p>
            ) : (
              <div className="space-y-1">
                {leads.map(lead => (
                  <button key={lead.id} onClick={() => runTest(lead.id)} disabled={running}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 text-left transition-colors disabled:opacity-50">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm font-medium flex-shrink-0">
                      {lead.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{lead.name}</p>
                      {lead.email && <p className="text-xs text-slate-400 truncate">{lead.email}</p>}
                    </div>
                    {running ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <Play className="w-4 h-4 text-slate-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Inner builder (needs ReactFlow context) ───────────────────────────────────

interface BuilderProps {
  automationId: string | null
  initialName?: string
  initialDescription?: string
  initialEnabled?: boolean
  initialAllowRepeat?: boolean
  initialDef?: AutomationDefinition
}

function BuilderInner({
  automationId,
  initialName = '',
  initialDescription = '',
  initialEnabled = true,
  initialAllowRepeat = false,
  initialDef,
}: BuilderProps) {
  const router = useRouter()
  const { fitView } = useReactFlow()

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [allowRepeat, setAllowRepeat] = useState(initialAllowRepeat)
  const [def, setDef] = useState<AutomationDefinition>(initialDef ?? EMPTY_DEF)
  const [selectedId, setSelectedId] = useState<string | null>('__trigger__')
  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTest, setShowTest] = useState(false)

  useEffect(() => { setTimeout(() => fitView({ padding: 0.3, duration: 200 }), 50) }, [fitView])

  const addStep = useCallback((insertAfterIdx: number, type: 'action' | 'delay' | 'condition') => {
    let newStep: BodyStep
    if (type === 'action') {
      newStep = { id: uid(), type: 'action', actionType: 'send_email', config: { to: '{{email}}' } }
    } else if (type === 'delay') {
      newStep = { id: uid(), type: 'delay', duration: 1, unit: 'days' }
    } else {
      newStep = { id: uid(), type: 'condition', conditions: [{ field: 'status', operator: 'equals', value: 'qualified' }], logicOperator: 'AND', ifTrue: [], ifFalse: [] }
    }
    setDef(d => {
      const steps = [...d.steps]
      steps.splice(insertAfterIdx + 1, 0, newStep)
      return { ...d, steps }
    })
    setSelectedId(newStep.id)
  }, [])

  const removeStep = useCallback((id: string) => {
    setDef(d => ({ ...d, steps: d.steps.filter(s => s.id !== id) }))
    setSelectedId('__trigger__')
  }, [])

  const updateStep = useCallback((id: string, updated: BodyStep) => {
    setDef(d => ({ ...d, steps: d.steps.map(s => s.id === id ? updated : s) }))
  }, [])

  const { nodes, edges } = useMemo(
    () => buildFlowData(def, selectedId, addStep, removeStep, setSelectedId),
    [def, selectedId, addStep, removeStep]
  )

  async function save() {
    if (!name.trim()) { setError('Automation name is required'); return }
    setSaving(true); setError(null); setSaved(false)
    try {
      const payload = { name: name.trim(), description: description.trim() || null, enabled, allowRepeat, steps: JSON.stringify(def), trigger: '', action: '' }
      const url = automationId ? `/api/automations/${automationId}` : '/api/automations'
      const method = automationId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setError(b.error ?? `Save failed (${res.status})`)
        return
      }
      const saved = await res.json()
      if (!automationId) {
        router.replace(`/automations/${saved.id}`)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const triggerLabel = TRIGGER_OPTIONS.find(o => o.value === def.trigger.triggerType)?.label ?? def.trigger.triggerType

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 80px)', minHeight: '600px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <button onClick={() => router.push('/automations')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Automation name…"
          className="flex-1 text-lg font-semibold text-slate-900 bg-transparent border-0 outline-none placeholder:text-slate-300 min-w-0"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setEnabled(!enabled)} className={`transition-colors ${enabled ? 'text-indigo-600' : 'text-slate-300'}`} title={enabled ? 'Enabled' : 'Disabled'}>
            {enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          </button>
          {automationId && (
            <button onClick={() => setShowTest(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors">
              <Play className="w-3.5 h-3.5" /> Test
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : automationId ? 'Save' : 'Create'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-red-600 text-sm flex-shrink-0">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      {automationId && (
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-200 bg-white flex-shrink-0">
          {(['builder', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab === 'builder' ? 'Builder' : 'Run History'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeTab === 'builder' ? (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 min-h-0 bg-slate-50/50">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll
              panOnScroll={false}
              minZoom={0.4}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} color="#cbd5e1" gap={16} size={1.5} />
              <Controls showInteractive={false} className="!border-slate-200 !shadow-sm" />
            </ReactFlow>
          </div>

          {/* Config panel */}
          <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto flex-shrink-0">
            <ConfigPanel
              def={def}
              selectedId={selectedId}
              onDefChange={setDef}
              onUpdateStep={updateStep}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/30">
          {automationId && <RunHistoryPanel automationId={automationId} />}
        </div>
      )}

      {/* Options bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 bg-white flex-shrink-0 text-sm text-slate-500">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={allowRepeat} onChange={e => setAllowRepeat(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
          Allow repeat runs per lead
        </label>
        {description !== undefined && (
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add description…"
            className="flex-1 text-sm bg-transparent border-0 outline-none text-slate-400 placeholder:text-slate-300 max-w-xs"
          />
        )}
        <span className="ml-auto text-xs text-slate-300">{def.steps.length} step{def.steps.length !== 1 ? 's' : ''} · {triggerLabel}</span>
      </div>

      {showTest && automationId && <TestRunModal automationId={automationId} onClose={() => setShowTest(false)} />}
    </div>
  )
}

// ─── Exported builder (wraps in ReactFlowProvider) ────────────────────────────

export default function AutomationBuilder(props: BuilderProps) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  )
}
