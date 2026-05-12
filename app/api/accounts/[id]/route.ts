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
  if (session.user.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { name, plan, isActive } = await req.json()

  const account = await prisma.account.update({
    where: { id },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(plan ? { plan } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
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
