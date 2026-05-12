import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)
  const automations = await prisma.automation.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(automations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId ?? null
  const body = await req.json()
  const { name, trigger, triggerConfig = {}, action = 'send_email', actionConfig = {} } = body

  if (!name?.trim() || !trigger) {
    return NextResponse.json({ error: 'name and trigger are required' }, { status: 400 })
  }

  const automation = await prisma.automation.create({
    data: {
      name: name.trim(),
      trigger,
      triggerConfig: JSON.stringify(triggerConfig),
      action,
      actionConfig: JSON.stringify(actionConfig),
      accountId,
    },
  })
  after(() => logAudit({ accountId, userId: session.user.id, userEmail: session.user.email, action: 'automation.created', entityType: 'automation', entityId: automation.id, entityLabel: automation.name, ipAddress: getIp(req) }))
  return NextResponse.json(automation, { status: 201 })
}
