import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { runAutomations } from '@/lib/automations'
import { sendPushToAccount } from '@/lib/push'
import { appendLeadToSheet } from '@/lib/google-sheets'
import { syncLeadToTrackingSheet } from '@/lib/lead-tracking-sheet'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const q = searchParams.get('q')
  const company = searchParams.get('company')
  const accountParam = searchParams.get('account')

  const accountFilter = getAccountFilter(session.user, accountParam)

  const leads = await prisma.lead.findMany({
    where: {
      ...accountFilter,
      ...(company ? { companyId: company } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}),
    },
    include: {
      company: { select: { name: true, color: true } },
      conversions: { orderBy: { sentAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })

  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const accountId =
    session.user.role === 'master_admin'
      ? (body.accountId ?? null)
      : (session.user.accountId ?? null)

  const lead = await prisma.lead.create({
    data: {
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      service: body.service || null,
      source: body.source || null,
      status: body.status ?? 'new',
      notes: body.notes || null,
      value: body.value ?? null,
      bestTimeToContact: body.bestTimeToContact || null,
      companyId: body.companyId || null,
      accountId,
    },
  })

  after(() => appendLeadToSheet(lead))
  after(() => syncLeadToTrackingSheet(accountId, lead))
  after(() => runAutomations('lead_created', lead))
  after(() => logAudit({ accountId, userId: session.user.id, userEmail: session.user.email, action: 'lead.created', entityType: 'lead', entityId: lead.id, entityLabel: lead.name, ipAddress: getIp(req) }))
  after(() => sendPushToAccount(accountId, {
    title: `New Lead: ${lead.name}`,
    body: [lead.service, lead.source].filter(Boolean).join(' · ') || 'New lead added',
    url: `/leads/${lead.id}`,
  }))
  return NextResponse.json(lead, { status: 201 })
}
