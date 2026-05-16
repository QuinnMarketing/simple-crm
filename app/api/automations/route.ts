import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const qAccountId = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, qAccountId)
  const automations = await prisma.automation.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(automations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const qAccountId = req.nextUrl.searchParams.get('account')
  const accountId = session.user.accountId ?? qAccountId ?? null

  const body = await req.json()
  const { name, description, steps, allowRepeat, trigger, triggerConfig = {}, action = 'send_email', actionConfig = {} } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const isNewStyle = !!steps && steps !== '{}'
  if (!isNewStyle && !trigger) {
    return NextResponse.json({ error: 'trigger is required' }, { status: 400 })
  }

  const automation = await prisma.automation.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      steps: isNewStyle ? steps : '{}',
      allowRepeat: allowRepeat ?? false,
      trigger: isNewStyle ? '' : trigger,
      triggerConfig: isNewStyle ? '{}' : JSON.stringify(triggerConfig),
      action: isNewStyle ? '' : action,
      actionConfig: isNewStyle ? '{}' : JSON.stringify(actionConfig),
      accountId,
    },
  })
  after(() => logAudit({ accountId, userId: session.user.id, userEmail: session.user.email, action: 'automation.created', entityType: 'automation', entityId: automation.id, entityLabel: automation.name, ipAddress: getIp(req) }))
  return NextResponse.json(automation, { status: 201 })
}
