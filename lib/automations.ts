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
