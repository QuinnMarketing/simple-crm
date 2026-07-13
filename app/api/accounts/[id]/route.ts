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

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, leads: true } },
      integrations: { select: { platform: true, enabled: true } },
    },
  })

  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(account)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const isMasterAdmin = session.user.role === 'master_admin'
  const isOwnAccount = session.user.accountId === id

  if (!isMasterAdmin && !isOwnAccount) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, plan, isActive, featTakeoffs, abn, businessAddress, businessPhone, businessEmail, businessWebsite } = body

  const account = await prisma.account.update({
    where: { id },
    data: {
      // Master admin only fields
      ...(isMasterAdmin && name?.trim() ? { name: name.trim() } : {}),
      ...(isMasterAdmin && plan ? { plan } : {}),
      ...(isMasterAdmin && isActive !== undefined ? { isActive } : {}),
      ...(isMasterAdmin && featTakeoffs !== undefined ? { featTakeoffs } : {}),
      // Business info — any account user can update
      ...('abn' in body ? { abn: abn?.trim() || null } : {}),
      ...('businessAddress' in body ? { businessAddress: businessAddress?.trim() || null } : {}),
      ...('businessPhone' in body ? { businessPhone: businessPhone?.trim() || null } : {}),
      ...('businessEmail' in body ? { businessEmail: businessEmail?.trim() || null } : {}),
      ...('businessWebsite' in body ? { businessWebsite: businessWebsite?.trim() || null } : {}),
      ...('slaHours' in body ? { slaHours: body.slaHours != null ? Number(body.slaHours) || null : null } : {}),
      ...('idleAlertDays' in body ? { idleAlertDays: body.idleAlertDays != null ? Number(body.idleAlertDays) || null : null } : {}),
      // Onboarding wizard completion — any account user can mark their own account onboarded.
      ...('onboardedAt' in body ? { onboardedAt: body.onboardedAt ? new Date(body.onboardedAt) : new Date() } : {}),
    },
    include: { _count: { select: { users: true, leads: true } } },
  })

  return NextResponse.json(account)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await prisma.account.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
