// ─── Trigger types ────────────────────────────────────────────────────────────

export type TriggerType =
  | 'lead_created'
  | 'lead_status_changed'
  | 'lead_field_changed'
  | 'appointment_created'
  | 'quote_created'
  | 'manual'
  | 'daily_scheduled'
  | 'relative_days'       // X days after lead creation (cron)
  | 'idle_lead'           // no activity for X days (cron)
  | 'pending_quote'       // quote unanswered for X days (cron)
  | 'appointment_reminder' // X hours before appointment (cron)

export interface TriggerConfig {
  // lead_status_changed
  fromStatus?: string
  toStatus?: string
  // lead_field_changed
  field?: string
  toValue?: string
  // daily_scheduled
  hour?: number // 0–23 UTC
  // relative_days / idle_lead / pending_quote
  days?: number
  // idle_lead
  statuses?: string[]
  // appointment_reminder
  hoursBeforeAppointment?: number
}

export interface TriggerNode {
  triggerType: TriggerType
  config: TriggerConfig
}

// ─── Body step types ──────────────────────────────────────────────────────────

export type ActionType =
  | 'send_email'
  | 'notify_team'
  | 'update_lead'
  | 'add_note'
  | 'send_webhook'

export interface ActionConfig {
  // send_email / notify_team
  to?: string
  subject?: string
  body?: string
  // update_lead
  field?: string
  value?: string
  // add_note
  content?: string
  // send_webhook
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers?: string // JSON string
  webhookBody?: string // JSON template string
}

export interface ActionStep {
  id: string
  type: 'action'
  actionType: ActionType
  label?: string
  config: ActionConfig
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'

export interface ConditionRule {
  field: string
  operator: ConditionOperator
  value: string
}

export interface ConditionStep {
  id: string
  type: 'condition'
  label?: string
  conditions: ConditionRule[]
  logicOperator: 'AND' | 'OR'
  ifTrue: ActionStep[]
  ifFalse: ActionStep[]
}

export interface DelayStep {
  id: string
  type: 'delay'
  label?: string
  duration: number
  unit: 'minutes' | 'hours' | 'days'
}

export type BodyStep = ActionStep | ConditionStep | DelayStep

// ─── Full automation definition ───────────────────────────────────────────────

export interface AutomationDefinition {
  trigger: TriggerNode
  steps: BodyStep[]
}

// ─── Execution context ────────────────────────────────────────────────────────

export interface ExecutionContext {
  leadId: string
  accountId: string
  lead: Record<string, unknown>
  triggerData: Record<string, unknown>
  variables: Record<string, string>
}

// ─── Trigger event ────────────────────────────────────────────────────────────

export interface TriggerEvent {
  type: TriggerType
  accountId: string
  leadId?: string
  payload?: Record<string, unknown>
}
