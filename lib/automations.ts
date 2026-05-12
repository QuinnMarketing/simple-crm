import { prisma } from './prisma'
import { sendEmail, type SmtpConfig } from './email'

type LeadContext = {
  name: string
  email: string | null
  phone: string | null
  service: string | null
  source: string | null
  status: string
  accountId: string | null
}

type AppointmentContext = {
  id: string
  title: string
  startTime: Date
  location: string | null
  accountId: string | null
  leadId: string | null
}

function fmtDate(dt: Date) {
  return dt.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
function fmtTime(dt: Date) {
  return dt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export async function runPendingQuoteFollowups(): Promise<{ sent: number; errors: number }> {
  let sent = 0
  let errors = 0

  const automations = await prisma.automation.findMany({
    where: { enabled: true, trigger: 'pending_quote_followup' },
    include: { logs: { select: { leadId: true } } },
  })

  for (const automation of automations) {
    if (!automation.accountId) continue
    const tc = JSON.parse(automation.triggerConfig) as { days?: number }
    const days = tc.days ?? 3
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const alreadyFiredLeadIds = new Set(automation.logs.map((l) => l.leadId))

    // Find leads with a sent quote older than `days` days that haven't been logged yet
    const sentQuotes = await prisma.quote.findMany({
      where: {
        accountId: automation.accountId,
        type: 'quote',
        status: 'sent',
        updatedAt: { lte: cutoff },
        leadId: { not: null },
      },
      select: { leadId: true, number: true },
      distinct: ['leadId'],
    })

    const eligibleLeadIds = sentQuotes
      .map((q) => q.leadId!)
      .filter((id) => !alreadyFiredLeadIds.has(id))

    if (eligibleLeadIds.length === 0) continue

    const [leads, smtpRow] = await Promise.all([
      prisma.lead.findMany({
        where: { id: { in: eligibleLeadIds }, email: { not: null } },
        select: { id: true, name: true, email: true, phone: true, service: true, source: true, status: true },
      }),
      prisma.accountIntegration.findUnique({
        where: { accountId_platform: { accountId: automation.accountId, platform: 'email_smtp' } },
      }),
    ])

    const smtpConfig: SmtpConfig | null = smtpRow?.enabled
      ? (JSON.parse(smtpRow.config) as SmtpConfig)
      : null

    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) continue

    const ac = JSON.parse(automation.actionConfig) as { subject?: string; body?: string }

    for (const lead of leads) {
      if (!lead.email) continue
      const vars: Record<string, string> = {
        name: lead.name,
        email: lead.email,
        phone: lead.phone ?? '',
        service: lead.service ?? '',
        source: lead.source ?? '',
        status: lead.status,
        days: String(days),
      }
      try {
        await sendEmail(smtpConfig, lead.email, interpolate(ac.subject ?? '', vars), interpolate(ac.body ?? '', vars))
        await prisma.automationLog.create({ data: { automationId: automation.id, leadId: lead.id } })
        sent++
      } catch (e) {
        console.error(`Pending quote followup "${automation.name}" failed for lead ${lead.id}:`, e)
        errors++
      }
    }
  }

  return { sent, errors }
}

export async function runAppointmentBookedAutomations(appointment: AppointmentContext) {
  if (!appointment.accountId || !appointment.leadId) return

  const [automations, smtpRow, lead] = await Promise.all([
    prisma.automation.findMany({
      where: { accountId: appointment.accountId, enabled: true, trigger: 'appointment_booked' },
    }),
    prisma.accountIntegration.findUnique({
      where: { accountId_platform: { accountId: appointment.accountId, platform: 'email_smtp' } },
    }),
    prisma.lead.findUnique({
      where: { id: appointment.leadId },
      select: { id: true, name: true, email: true, phone: true, service: true, source: true, status: true },
    }),
  ])

  if (automations.length === 0 || !lead?.email) return

  const smtpConfig: SmtpConfig | null = smtpRow?.enabled ? (JSON.parse(smtpRow.config) as SmtpConfig) : null
  if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) return

  const vars: Record<string, string> = {
    name: lead.name, email: lead.email, phone: lead.phone ?? '',
    service: lead.service ?? '', source: lead.source ?? '', status: lead.status,
    title: appointment.title, date: fmtDate(appointment.startTime),
    time: fmtTime(appointment.startTime), location: appointment.location ?? '',
  }

  for (const automation of automations) {
    const ac = JSON.parse(automation.actionConfig) as { subject?: string; body?: string }
    try {
      await sendEmail(smtpConfig, lead.email, interpolate(ac.subject ?? '', vars), interpolate(ac.body ?? '', vars))
    } catch (e) {
      console.error(`Appointment booked automation "${automation.name}" failed:`, e)
    }
  }
}

export async function runAppointmentReminderAutomations(): Promise<{ sent: number; errors: number }> {
  let sent = 0; let errors = 0

  const automations = await prisma.automation.findMany({
    where: { enabled: true, trigger: 'appointment_reminder' },
    include: { logs: { select: { leadId: true } } },
  })

  const now = new Date()
  // Window: appointments starting between 23h and 25h from now
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  for (const automation of automations) {
    if (!automation.accountId) continue

    // leadId column stores appointmentId for appointment automations (no FK constraint)
    const alreadyFiredIds = new Set(automation.logs.map((l) => l.leadId))

    const [appointments, smtpRow] = await Promise.all([
      prisma.appointment.findMany({
        where: { accountId: automation.accountId, startTime: { gte: windowStart, lte: windowEnd }, leadId: { not: null } },
        include: { lead: { select: { id: true, name: true, email: true, phone: true, service: true, source: true, status: true } } },
      }),
      prisma.accountIntegration.findUnique({
        where: { accountId_platform: { accountId: automation.accountId, platform: 'email_smtp' } },
      }),
    ])

    const smtpConfig: SmtpConfig | null = smtpRow?.enabled ? (JSON.parse(smtpRow.config) as SmtpConfig) : null
    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) continue

    const ac = JSON.parse(automation.actionConfig) as { subject?: string; body?: string }

    for (const appt of appointments) {
      if (alreadyFiredIds.has(appt.id)) continue
      const lead = appt.lead
      if (!lead?.email) continue

      const vars: Record<string, string> = {
        name: lead.name, email: lead.email, phone: lead.phone ?? '',
        service: lead.service ?? '', source: lead.source ?? '', status: lead.status,
        title: appt.title, date: fmtDate(appt.startTime),
        time: fmtTime(appt.startTime), location: appt.location ?? '',
      }
      try {
        await sendEmail(smtpConfig, lead.email, interpolate(ac.subject ?? '', vars), interpolate(ac.body ?? '', vars))
        await prisma.automationLog.create({ data: { automationId: automation.id, leadId: appt.id } })
        sent++
      } catch (e) {
        console.error(`Appointment reminder "${automation.name}" failed for appointment ${appt.id}:`, e)
        errors++
      }
    }
  }

  return { sent, errors }
}

export async function runAutomations(
  trigger: 'lead_created' | 'lead_status_changed',
  lead: LeadContext,
  ctx: { previousStatus?: string } = {}
) {
  if (!lead.accountId) return

  const [automations, smtpRow] = await Promise.all([
    prisma.automation.findMany({
      where: { accountId: lead.accountId, enabled: true, trigger },
    }),
    prisma.accountIntegration.findUnique({
      where: { accountId_platform: { accountId: lead.accountId, platform: 'email_smtp' } },
    }),
  ])

  if (automations.length === 0) return

  const smtpConfig: SmtpConfig | null = smtpRow?.enabled
    ? (JSON.parse(smtpRow.config) as SmtpConfig)
    : null

  const vars: Record<string, string> = {
    name: lead.name,
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    service: lead.service ?? '',
    source: lead.source ?? '',
    status: lead.status,
  }

  for (const automation of automations) {
    const triggerConfig = JSON.parse(automation.triggerConfig) as { toStatus?: string }
    const actionConfig = JSON.parse(automation.actionConfig) as { subject?: string; body?: string }

    // Check trigger filter for status change
    if (trigger === 'lead_status_changed') {
      if (triggerConfig.toStatus && lead.status !== triggerConfig.toStatus) continue
      if (lead.status === ctx.previousStatus) continue
    }

    if (automation.action === 'send_email') {
      if (!lead.email || !smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) continue
      const subject = interpolate(actionConfig.subject ?? '', vars)
      const body = interpolate(actionConfig.body ?? '', vars)
      try {
        await sendEmail(smtpConfig, lead.email, subject, body)
      } catch (e) {
        console.error(`Automation "${automation.name}" email failed:`, e)
      }
    }
  }
}
