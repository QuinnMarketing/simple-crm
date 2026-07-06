import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type P = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const acct = await prisma.adPlatformAccount.findUnique({ where: { id } })
  if (!acct) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(acct.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.adPlatformAccount.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const acct = await prisma.adPlatformAccount.findUnique({ where: { id } })
  if (!acct) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(acct.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const updated = await prisma.adPlatformAccount.update({
    where: { id },
    data: {
      ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
    },
  })
  return NextResponse.json({ account: updated })
}
