import { prisma } from './prisma'
import { sendEmail } from './email'
import { getAccountSmtp } from './email-from'
import { sendPushToAccount } from './push'
import type {
  AutomationDefinition,
  BodyStep,
  ActionStep,
  ConditionStep,
  DelayStep,
  ExecutionContext,
  TriggerEvent,
  TriggerType,
  ConditionRule,
} from './automation-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function interpolate(template: string, ctx: ExecutionContext): string {
  const lead = ctx.lead
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    String(ctx.variables[key] ?? lead[key] ?? '')
  )
}

function evalRule(rule: ConditionRule, lead: Record<string, unknown>): boolean {
  const actual = String(lead[rule.field] ?? '').toLowerCase()
  const expected = rule.value.toLowerCase()
  switch (rule.operator) {
    case 'equals':      return actual === expected
    case 'not_equals':  return actual !== expected
    case 'contains':    return actual.includes(expected)
    case 'not_contains':return !actual.includes(expected)
    case 'starts_with': return actual.startsWith(expected)
    case 'greater_than':return parseFloat(actual) > parseFloat(expected)
    case 'less_than':   return parseFloat(actual) < parseFloat(expected)
    case 'is_empty':    return !actual.trim()
    case 'is_not_empty':return !!actual.trim()
    default:            return false
  }
}

function evalCondition(step: ConditionStep, lead: Record<string, unknown>): boolean {
  if (!step.conditions.length) return true
  const results = step.conditions.map((r) => evalRule(r, lead))
  return step.logicOperator === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

function parseDef(raw: string): AutomationDefinition | null {
  if (!raw || raw === '{}' || raw === '[]') return null
  try {
    const def = JSON.parse(raw) as AutomationDefinition
    return def?.trigger?.triggerType ? def : null
  } catch {
    return null
  }
}

function triggerMatches(def: AutomationDefinition, event: TriggerEvent): boolean {
  const { trigger } = def
  if (trigger.triggerType !== event.type) return false
  const cfg = trigger.config
  const p = event.payload ?? {}

  switch (trigger.triggerType as TriggerType) {
    case 'lead_status_changed':
      if (cfg.toStatus && p.toStatus !== cfg.toStatus) return false
      if (cfg.fromStatus && p.fromStatus !== cfg.fromStatus) return false
      return true
    case 'lead_field_changed':
      if (cfg.field && p.field !== cfg.field) return false
      if (cfg.toValue && p.toValue !== cfg.toValue) return false
      return true
    default:
      return true
  }
}

async function buildContext(
  accountId: string,
  leadId?: string,
  triggerData?: Record<string, unknown>
): Promise<ExecutionContext> {
  let lead: Record<string, unknown> = {}
  if (leadId) {
    const row = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { customFieldValues: { include: { customField: true } } },
    })
    if (row) {
      lead = row as unknown as Record<string, unknown>
      for (const cfv of row.customFieldValues ?? []) {
        const key = `cf_${cfv.customField.name.toLowerCase().replace(/\s+/g, '_')}`
        lead[key] = cfv.value
      }
    }
  }
  return { leadId: leadId ?? '', accountId, lead, triggerData: triggerData ?? {}, variables: {} }
}

// ─── Action executor ──────────────────────────────────────────────────────────

async function execAction(
  step: ActionStep,
  ctx: ExecutionContext,
): Promise<Record<string, unknown>> {
  const cfg = step.config
  const i = (s?: string) => (s ? interpolate(s, ctx) : '')

  switch (step.actionType) {
    case 'send_email': {
      const to = i(cfg.to) || String(ctx.lead.email ?? '')
      if (!to) throw new Error('No recipient email address')
      const smtp = await getAccountSmtp(ctx.accountId)
      await sendEmail(smtp, to, i(cfg.subject), i(cfg.body))
      return { sentTo: to }
    }

    case 'notify_team': {
      const to = i(cfg.to)
      if (!to) throw new Error('No team email address specified')
      const smtp = await getAccountSmtp(ctx.accountId)
      await sendEmail(smtp, to, i(cfg.subject) || 'CRM Notification', i(cfg.body))
      return { sentTo: to }
    }

    case 'send_push': {
      // Push reaches the account's subscribed CRM users (the business team's
      // devices), not the lead/customer. Deep-links to the lead by default.
      const title = i(cfg.pushTitle) || 'CRM Notification'
      const body = i(cfg.pushBody)
      const url = i(cfg.pushUrl) || (ctx.leadId ? `/leads/${ctx.leadId}` : '/')
      await sendPushToAccount(ctx.accountId, { title, body, url })
      return { pushed: title, url }
    }

    case 'update_lead': {
      if (!ctx.leadId) throw new Error('No lead in context')
      const field = cfg.field
      if (!field) throw new Error('No field specified')
      const ALLOWED = ['status','source','service','notes','address','nextStep','nextStepDue','bestTimeToContact']
      if (!ALLOWED.includes(field)) throw new Error(`Field "${field}" is not updatable`)
      const value = i(cfg.value)
      await prisma.lead.update({ where: { id: ctx.leadId }, data: { [field]: value } })
      ctx.lead[field] = value
      return { updated: field, to: value }
    }

    case 'add_note': {
      if (!ctx.leadId) throw new Error('No lead in context')
      const content = i(cfg.content)
      const existing = await prisma.lead.findUnique({ where: { id: ctx.leadId }, select: { notes: true } })
      const ts = new Date().toLocaleDateString('en-AU')
      const notes = existing?.notes
        ? `${existing.notes}\n\n[${ts} — Automation] ${content}`
        : `[${ts} — Automation] ${content}`
      await prisma.lead.update({ where: { id: ctx.leadId }, data: { notes } })
      return { added: content }
    }

    case 'send_webhook': {
      const url = i(cfg.url)
      if (!url) throw new Error('No webhook URL')
      const method = cfg.method ?? 'POST'
      let headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try { if (cfg.headers) Object.assign(headers, JSON.parse(cfg.headers)) } catch { /* ignore */ }
      const body = cfg.webhookBody ? i(cfg.webhookBody) : JSON.stringify({ lead: ctx.lead })
      const res = await fetch(url, { method, headers, ...(method !== 'GET' ? { body } : {}) })
      return { status: res.status, ok: res.ok }
    }

    case 'create_appointment': {
      if (!ctx.leadId) throw new Error('No lead in context')
      const title = i(cfg.appointmentTitle) || `Follow up: ${String(ctx.lead.name ?? '')}`
      const days = cfg.daysFromNow ?? 1
      const hour = cfg.hour ?? 9
      const duration = cfg.duration ?? 60
      const start = new Date()
      start.setDate(start.getDate() + days)
      start.setHours(hour, 0, 0, 0)
      const end = new Date(start.getTime() + duration * 60_000)
      const appt = await prisma.appointment.create({
        data: {
          title,
          startTime: start,
          endTime: end,
          leadId: ctx.leadId,
          accountId: ctx.accountId,
          description: cfg.appointmentNotes ? i(cfg.appointmentNotes) : undefined,
        },
      })
      return { appointmentId: appt.id, title, startTime: start.toISOString() }
    }

    default:
      throw new Error(`Unknown action type: ${(step as ActionStep).actionType}`)
  }
}

// ─── Step executor ────────────────────────────────────────────────────────────

async function execBranch(
  runId: string,
  steps: ActionStep[],
  ctx: ExecutionContext,
  parentStepId: string,
  branchLabel: string
) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    try {
      const out = await execAction(step, ctx)
      await prisma.automationStepLog.create({
        data: { runId, stepId: `${parentStepId}:${branchLabel}:${i}`, stepType: step.actionType, label: step.label, status: 'completed', output: JSON.stringify(out) },
      })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      await prisma.automationStepLog.create({
        data: { runId, stepId: `${parentStepId}:${branchLabel}:${i}`, stepType: step.actionType, label: step.label, status: 'failed', error },
      })
      throw e
    }
  }
}

async function execSteps(
  runId: string,
  steps: BodyStep[],
  ctx: ExecutionContext,
  startIndex: number,
  automation: { id: string }
) {
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i]

    if (step.type === 'action') {
      try {
        const out = await execAction(step, ctx)
        await prisma.automationStepLog.create({
          data: { runId, stepId: step.id, stepType: step.actionType, label: step.label, status: 'completed', output: JSON.stringify(out) },
        })
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        await prisma.automationStepLog.create({
          data: { runId, stepId: step.id, stepType: step.actionType, label: step.label, status: 'failed', error },
        })
        await prisma.automationRun.update({ where: { id: runId }, data: { status: 'failed', completedAt: new Date() } })
        return
      }

    } else if (step.type === 'condition') {
      const passed = evalCondition(step as ConditionStep, ctx.lead)
      await prisma.automationStepLog.create({
        data: { runId, stepId: step.id, stepType: 'condition', label: step.label, status: 'completed', output: JSON.stringify({ passed }) },
      })
      const branch = passed ? (step as ConditionStep).ifTrue : (step as ConditionStep).ifFalse
      const label = passed ? 'ifTrue' : 'ifFalse'
      if (branch?.length) {
        try { await execBranch(runId, branch, ctx, step.id, label) }
        catch {
          await prisma.automationRun.update({ where: { id: runId }, data: { status: 'failed', completedAt: new Date() } })
          return
        }
      }

    } else if (step.type === 'delay') {
      const ds = step as DelayStep
      const ms = ds.duration * (ds.unit === 'minutes' ? 60_000 : ds.unit === 'hours' ? 3_600_000 : 86_400_000)
      const resumeAt = new Date(Date.now() + ms)
      await prisma.automationStepLog.create({
        data: { runId, stepId: step.id, stepType: 'delay', label: step.label, status: 'completed', output: JSON.stringify({ resumeAt, resumeAtIndex: i + 1 }) },
      })
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: 'waiting', resumeAt, resumeAtIndex: i + 1, context: JSON.stringify(ctx) },
      })
      return // Cron will resume this run
    }
  }

  // All steps complete
  await prisma.automationRun.update({ where: { id: runId }, data: { status: 'completed', completedAt: new Date() } })
  await prisma.automation.update({ where: { id: automation.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function testRunAutomation(
  automation: { id: string; steps: string; accountId: string | null },
  leadId: string,
): Promise<string> {
  const def = parseDef(automation.steps)
  if (!def) throw new Error('Invalid automation definition')
  const ctx = await buildContext(automation.accountId ?? '', leadId)
  const run = await prisma.automationRun.create({
    data: {
      automationId: automation.id,
      leadId,
      status: 'running',
      context: JSON.stringify({ ...ctx, isTestRun: true }),
    },
  })
  try {
    await execSteps(run.id, def.steps, ctx, 0, automation)
  } catch {
    await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: new Date() } })
  }
  return run.id
}

export async function fireAutomationEvent(event: TriggerEvent) {
  const automations = await prisma.automation.findMany({
    where: { accountId: event.accountId, enabled: true },
  })

  for (const automation of automations) {
    const def = parseDef(automation.steps)
    if (!def) continue
    if (!triggerMatches(def, event)) continue

    // Deduplication — skip if already ran on this lead (unless allowRepeat)
    if (event.leadId && !automation.allowRepeat) {
      const existing = await prisma.automationRun.findFirst({
        where: { automationId: automation.id, leadId: event.leadId, status: { in: ['completed', 'running', 'waiting'] } },
      })
      if (existing) continue
    }

    const ctx = await buildContext(event.accountId, event.leadId, event.payload)
    const run = await prisma.automationRun.create({
      data: { automationId: automation.id, leadId: event.leadId ?? null, status: 'running', context: JSON.stringify(ctx) },
    })

    try {
      await execSteps(run.id, def.steps, ctx, 0, automation)
    } catch {
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: new Date() } })
    }
  }
}

export async function resumeWaitingRuns() {
  const waiting = await prisma.automationRun.findMany({
    where: { status: 'waiting', resumeAt: { lte: new Date() } },
    include: { automation: { select: { id: true, steps: true } } },
    take: 50,
  })

  for (const run of waiting) {
    const def = parseDef(run.automation.steps)
    if (!def || run.resumeAtIndex == null) {
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: new Date() } })
      continue
    }

    let ctx: ExecutionContext
    try { ctx = JSON.parse(run.context) }
    catch { await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: new Date() } }); continue }

    await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'running', resumeAt: null, resumeAtIndex: null } })

    try {
      await execSteps(run.id, def.steps, ctx, run.resumeAtIndex, run.automation)
    } catch {
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: new Date() } })
    }
  }
}

// ─── Scheduled / cron triggers ────────────────────────────────────────────────

export async function runScheduledAutomations() {
  const automations = await prisma.automation.findMany({ where: { enabled: true } })

  for (const automation of automations) {
    const def = parseDef(automation.steps)
    if (!def) continue
    const { triggerType, config } = def.trigger

    // relative_days: fire X days after lead creation (once per lead)
    if (triggerType === 'relative_days' && config.days) {
      const cutoff = new Date(Date.now() - config.days * 86_400_000)
      const start = new Date(cutoff.getTime() - 86_400_000) // 24h window
      const leads = await prisma.lead.findMany({
        where: { accountId: automation.accountId ?? '', createdAt: { gte: start, lte: cutoff } },
        select: { id: true },
      })
      for (const lead of leads) {
        const existing = await prisma.automationRun.findFirst({
          where: { automationId: automation.id, leadId: lead.id },
        })
        if (existing) continue
        await fireAutomationEvent({ type: 'relative_days', accountId: automation.accountId ?? '', leadId: lead.id })
      }
    }

    // idle_lead: no activity for X days
    if (triggerType === 'idle_lead' && config.days) {
      const cutoff = new Date(Date.now() - config.days * 86_400_000)
      const statuses = config.statuses?.length ? config.statuses : ['new', 'contacted', 'qualified']
      const leads = await prisma.lead.findMany({
        where: { accountId: automation.accountId ?? '', status: { in: statuses }, updatedAt: { lte: cutoff } },
        select: { id: true },
      })
      for (const lead of leads) {
        if (!automation.allowRepeat) {
          const existing = await prisma.automationRun.findFirst({
            where: { automationId: automation.id, leadId: lead.id, status: { in: ['completed', 'running', 'waiting'] } },
          })
          if (existing) continue
        }
        await fireAutomationEvent({ type: 'idle_lead', accountId: automation.accountId ?? '', leadId: lead.id })
      }
    }

    // pending_quote: quote unanswered for X days
    if (triggerType === 'pending_quote' && config.days) {
      const cutoff = new Date(Date.now() - config.days * 86_400_000)
      const quotes = await prisma.quote.findMany({
        where: { accountId: automation.accountId ?? '', type: 'quote', status: 'sent', updatedAt: { lte: cutoff }, leadId: { not: null } },
        select: { leadId: true },
        distinct: ['leadId'],
      })
      for (const q of quotes) {
        if (!q.leadId) continue
        const existing = await prisma.automationRun.findFirst({
          where: { automationId: automation.id, leadId: q.leadId, status: { in: ['completed', 'running', 'waiting'] } },
        })
        if (existing) continue
        await fireAutomationEvent({ type: 'pending_quote', accountId: automation.accountId ?? '', leadId: q.leadId })
      }
    }

    // appointment_reminder: X hours before appointment
    if (triggerType === 'appointment_reminder') {
      const hours = config.hoursBeforeAppointment ?? 24
      const windowStart = new Date(Date.now() + (hours - 2) * 3_600_000)
      const windowEnd = new Date(Date.now() + (hours + 2) * 3_600_000)
      const appointments = await prisma.appointment.findMany({
        where: { accountId: automation.accountId ?? '', startTime: { gte: windowStart, lte: windowEnd }, leadId: { not: null } },
        select: { id: true, leadId: true, title: true, startTime: true, location: true },
      })
      for (const appt of appointments) {
        if (!appt.leadId) continue
        const existing = await prisma.automationRun.findFirst({
          where: { automationId: automation.id, leadId: appt.id },
        })
        if (existing) continue
        await fireAutomationEvent({
          type: 'appointment_reminder',
          accountId: automation.accountId ?? '',
          leadId: appt.leadId,
          payload: { appointmentId: appt.id, title: appt.title, startTime: appt.startTime.toISOString(), location: appt.location },
        })
        // Use appointmentId as "leadId" for dedup to match appointment, not lead
        await prisma.automationRun.updateMany({
          where: { automationId: automation.id, leadId: appt.leadId, status: 'completed' },
          data: { leadId: appt.id },
        })
      }
    }
  }
}
