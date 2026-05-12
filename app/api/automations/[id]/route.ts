import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.automation.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = body.name
  if ('enabled' in body) updates.enabled = body.enabled
  if ('trigger' in body) updates.trigger = body.trigger
  if ('triggerConfig' in body) updates.triggerConfig = JSON.stringify(body.triggerConfig)
  if ('actionConfig' in body) updates.actionConfig = JSON.stringify(body.actionConfig)

  const automation = await prisma.automation.update({ where: { id }, data: updates })
  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'automation.updated', entityType: 'automation', entityId: automation.id, entityLabel: automation.name, ipAddress: getIp(req) }))
  return NextResponse.json(automation)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.automation.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.automation.delete({ where: { id } })
  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'automation.deleted', entityType: 'automation', entityId: id, entityLabel: existing.name, ipAddress: getIp(req) }))
  return NextResponse.json({ success: true })
}
