import { auth } from '@/auth'
import { logAudit, auditDiff, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { pushToGoogleAds, type GoogleAdsConfig } from '@/lib/google-ads'
import { runAutomations } from '@/lib/automations'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

async function getAdsConfig(accountId: string | null): Promise<GoogleAdsConfig | null> {
  if (!accountId) return null
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'google_ads' } },
  })
  if (!integration?.enabled) return null
  try { return JSON.parse(integration.config) } catch { return null }
}

async function autoConversionPush(
  lead: { id: string; gclid: string | null; value: number | null; createdAt: Date; accountId: string | null },
  newStatus: string
) {
  if (!lead.gclid) return
  const config = await getAdsConfig(lead.accountId)
  if (!config) return

  const conversionActionId = newStatus === 'qualified'
    ? config.qualifiedConversionActionId
    : config.wonConversionActionId

  if (!conversionActionId) return

  const result = await pushToGoogleAds(
    { gclid: lead.gclid, value: lead.value, createdAt: lead.createdAt },
    config,
    { conversionActionId, conversionDateTime: new Date() }
  )

  await prisma.conversionEvent.create({
    data: {
      leadId: lead.id,
      platform: 'google_ads',
      eventName: newStatus === 'qualified' ? 'qualified_lead' : 'converted_lead',
      value: lead.value,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
      response: JSON.stringify(result),
    },
  })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const lead = await prisma.lead.findFirst({
    where: { id, ...filter },
    include: {
      company: { select: { name: true, color: true } },
      conversions: { orderBy: { sentAt: 'desc' } },
      appointments: {
        orderBy: { startTime: 'asc' },
        include: { lead: { select: { id: true, name: true } } },
      },
      account: { select: { slaHours: true } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const filter = getAccountFilter(session.user)

  const existing = await prisma.lead.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only update fields that are explicitly present in the request body
  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = body.name
  if ('email' in body) updates.email = body.email || null
  if ('phone' in body) updates.phone = body.phone || null
  if ('address' in body) updates.address = body.address || null
  if ('service' in body) updates.service = body.service || null
  if ('source' in body) updates.source = body.source || null
  if ('status' in body) updates.status = body.status
  if ('notes' in body) updates.notes = body.notes || null
  if ('value' in body) updates.value = body.value ?? null
  if ('gclid' in body) updates.gclid = body.gclid || null
  if ('fbclid' in body) updates.fbclid = body.fbclid || null
  if ('companyId' in body) updates.companyId = body.companyId || null
  if ('nextStep' in body) updates.nextStep = body.nextStep || null
  if ('nextStepDue' in body) updates.nextStepDue = body.nextStepDue || null
  if ('lostReason' in body) updates.lostReason = body.lostReason || null
  if ('bestTimeToContact' in body) updates.bestTimeToContact = body.bestTimeToContact || null

  // Auto-stamp first response when status moves away from 'new' for the first time
  const newStatus = body.status as string | undefined
  if (newStatus && newStatus !== 'new' && existing.status === 'new' && !existing.firstRespondedAt) {
    updates.firstRespondedAt = new Date()
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: updates,
    include: {
      company: { select: { name: true, color: true } },
      conversions: { orderBy: { sentAt: 'desc' } },
    },
  })

  if (newStatus && newStatus !== existing.status) {
    if (newStatus === 'qualified' || newStatus === 'won') {
      after(() => autoConversionPush(
        { id: lead.id, gclid: lead.gclid, value: lead.value, createdAt: lead.createdAt, accountId: lead.accountId },
        newStatus
      ))
    }
    after(() => runAutomations('lead_status_changed', lead, { previousStatus: existing.status }))
  }

  after(() => logAudit({ accountId: lead.accountId, userId: session.user.id, userEmail: session.user.email, action: 'lead.updated', entityType: 'lead', entityId: lead.id, entityLabel: lead.name, changes: auditDiff(existing as Record<string, unknown>, lead as Record<string, unknown>), ipAddress: getIp(req) }))
  return NextResponse.json(lead)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const existing = await prisma.lead.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.lead.delete({ where: { id } })
  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'lead.deleted', entityType: 'lead', entityId: id, entityLabel: existing.name, ipAddress: getIp(req) }))
  return NextResponse.json({ success: true })
}
