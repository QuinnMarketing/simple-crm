import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextResponse } from 'next/server'

export type TimelineEvent = {
  id: string
  type: 'created' | 'status' | 'updated' | 'appointment' | 'quote' | 'conversion' | 'note'
  title: string
  detail?: string
  date: string
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const lead = await prisma.lead.findFirst({ where: { id, ...filter }, select: { id: true, createdAt: true, source: true, pageUrl: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [auditLogs, appointments, quotes, conversions] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: 'lead', entityId: id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.appointment.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, startTime: true, createdAt: true },
    }),
    prisma.quote.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, number: true, status: true, total: true, createdAt: true },
    }),
    prisma.conversionEvent.findMany({
      where: { leadId: id },
      orderBy: { sentAt: 'desc' },
      select: { id: true, platform: true, status: true, sentAt: true },
    }),
  ])

  const SOURCE_LABELS: Record<string, string> = {
    website: 'Website', referral: 'Referral', google_ads: 'Google Ads',
    facebook_ads: 'Facebook Ads', cold_outreach: 'Cold Outreach', webhook: 'Webhook', other: 'Other',
  }

  const events: TimelineEvent[] = []

  // Lead created — show page + source if available
  let createdTitle = 'Lead created'
  let createdDetail: string | undefined

  if (lead.pageUrl) {
    try {
      const { hostname, pathname } = new URL(lead.pageUrl)
      const page = pathname.length > 1 ? pathname : hostname
      createdTitle = `Submitted form on ${page}`
      if (lead.source) createdDetail = SOURCE_LABELS[lead.source] ?? lead.source
    } catch {
      createdTitle = 'Submitted form'
      createdDetail = lead.pageUrl
    }
  } else if (lead.source) {
    createdDetail = `Via ${SOURCE_LABELS[lead.source] ?? lead.source}`
  }

  events.push({
    id: `created-${lead.id}`,
    type: 'created',
    title: createdTitle,
    detail: createdDetail,
    date: lead.createdAt.toISOString(),
  })

  // Audit log events
  for (const log of auditLogs) {
    if (log.action === 'lead.created') continue // already shown above

    let changes: Record<string, [unknown, unknown]> | null = null
    try { changes = log.changes ? JSON.parse(log.changes) : null } catch { /* ignore */ }

    if (changes?.status) {
      const [from, to] = changes.status as [string, string]
      events.push({
        id: log.id,
        type: 'status',
        title: `Status changed to ${to}`,
        detail: `from ${from}`,
        date: log.createdAt.toISOString(),
      })
    } else if (changes?.notes && !changes?.status) {
      events.push({
        id: log.id,
        type: 'note',
        title: 'Notes updated',
        detail: log.userEmail ?? undefined,
        date: log.createdAt.toISOString(),
      })
    } else if (log.action === 'lead.updated' && changes && Object.keys(changes).length > 0) {
      const fields = Object.keys(changes).filter(f => f !== 'updatedAt').join(', ')
      if (fields) {
        events.push({
          id: log.id,
          type: 'updated',
          title: `Updated: ${fields}`,
          detail: log.userEmail ?? undefined,
          date: log.createdAt.toISOString(),
        })
      }
    }
  }

  // Appointments
  const PLATFORM_LABELS: Record<string, string> = {
    google_ga4: 'GA4', google_ads: 'Google Ads', facebook: 'Facebook',
  }

  for (const a of appointments) {
    events.push({
      id: `appt-${a.id}`,
      type: 'appointment',
      title: a.title,
      detail: new Date(a.startTime).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
      date: a.createdAt.toISOString(),
    })
  }

  // Quotes & invoices
  for (const q of quotes) {
    events.push({
      id: `quote-${q.id}`,
      type: 'quote',
      title: `${q.type === 'invoice' ? 'Invoice' : 'Quote'} ${q.number} created`,
      detail: `$${q.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })} — ${q.status}`,
      date: q.createdAt.toISOString(),
    })
  }

  // Conversions
  for (const c of conversions) {
    events.push({
      id: `conv-${c.id}`,
      type: 'conversion',
      title: `Pushed to ${PLATFORM_LABELS[c.platform] ?? c.platform}`,
      detail: c.status === 'sent' ? 'Sent successfully' : 'Failed',
      date: c.sentAt.toISOString(),
    })
  }

  // Sort newest first
  events.sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json(events)
}
