import { auth } from '@/auth'
import { logAudit, auditDiff, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color } = await req.json()
  const filter = getAccountFilter(session.user)

  const existing = await prisma.company.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(color ? { color } : {}),
    },
    include: { _count: { select: { leads: true } } },
  })

  after(() => logAudit({ accountId: company.accountId, userId: session.user.id, userEmail: session.user.email, action: 'company.updated', entityType: 'company', entityId: company.id, entityLabel: company.name, changes: auditDiff(existing as Record<string, unknown>, company as Record<string, unknown>), ipAddress: getIp(req) }))
  return NextResponse.json(company)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const existing = await prisma.company.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.lead.updateMany({ where: { companyId: id }, data: { companyId: null } })
  await prisma.company.delete({ where: { id } })

  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'company.deleted', entityType: 'company', entityId: id, entityLabel: existing.name, ipAddress: getIp(req) }))
  return NextResponse.json({ success: true })
}
