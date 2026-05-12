import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (session.user.role !== 'master_admin' && session.user.accountId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const integrations = await prisma.accountIntegration.findMany({
    where: { accountId: id },
  })

  return NextResponse.json(integrations)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const canManage =
    session.user.role === 'master_admin' ||
    (['account_admin', 'admin'].includes(session.user.role) && session.user.accountId === id)

  if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { platform, config, enabled } = await req.json()
  if (!platform) return NextResponse.json({ error: 'Platform is required' }, { status: 400 })

  const integration = await prisma.accountIntegration.upsert({
    where: { accountId_platform: { accountId: id, platform } },
    create: {
      accountId: id,
      platform,
      config: JSON.stringify(config ?? {}),
      enabled: enabled ?? true,
    },
    update: {
      config: JSON.stringify(config ?? {}),
      ...(enabled !== undefined ? { enabled } : {}),
    },
  })

  return NextResponse.json(integration)
}
