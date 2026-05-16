import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import bcrypt from 'bcryptjs'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, email, password, role, accountIds: bodyAccountIds } = await req.json()

  const filter = getAccountFilter(session.user)
  const existing = await prisma.user.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (email && email !== existing.email) {
    const conflict = await prisma.user.findUnique({ where: { email } })
    if (conflict) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  }

  let updatedRole: string | undefined
  if (role) {
    if (session.user.role === 'master_admin') {
      updatedRole = role
    } else if (session.user.role === 'account_admin' || session.user.role === 'admin') {
      updatedRole = ['account_admin', 'admin'].includes(role) ? 'account_admin' : 'account_user'
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name || null } : {}),
      ...(email ? { email } : {}),
      ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
      ...(updatedRole ? { role: updatedRole } : {}),
    },
    select: {
      id: true, email: true, name: true, role: true, accountId: true, createdAt: true,
      userAccounts: { select: { accountId: true } },
    },
  })

  // Sync accountIds if provided (master_admin only)
  if (session.user.role === 'master_admin' && Array.isArray(bodyAccountIds)) {
    // Determine new primary account (first in list, or keep existing)
    const newPrimary = bodyAccountIds[0] ?? null

    await prisma.$transaction([
      // Replace all UserAccount join rows
      prisma.userAccount.deleteMany({ where: { userId: id } }),
      ...(bodyAccountIds.length > 0
        ? [prisma.userAccount.createMany({ data: bodyAccountIds.map((aid: string) => ({ userId: id, accountId: aid })) })]
        : []),
      // Update primary accountId on User
      prisma.user.update({ where: { id }, data: { accountId: newPrimary } }),
    ])

    const refreshed = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, accountId: true, createdAt: true, userAccounts: { select: { accountId: true } } },
    })
    if (!refreshed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'user.updated', entityType: 'user', entityId: refreshed.id, entityLabel: refreshed.email, ipAddress: getIp(req) }))
    return NextResponse.json({
      ...refreshed,
      accountIds: refreshed.userAccounts.map(a => a.accountId),
    })
  }

  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'user.updated', entityType: 'user', entityId: user.id, entityLabel: user.email, ipAddress: getIp(req) }))
  return NextResponse.json({
    ...user,
    accountIds: Array.from(new Set([...(user.accountId ? [user.accountId] : []), ...user.userAccounts.map(a => a.accountId)])),
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (session.user?.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const filter = getAccountFilter(session.user)
  const existing = await prisma.user.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Prevent deleting the last user in an account
  if (existing.accountId) {
    const countInAccount = await prisma.user.count({ where: { accountId: existing.accountId } })
    if (countInAccount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last user in this account' }, { status: 400 })
    }
  } else {
    const total = await prisma.user.count()
    if (total <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last user' }, { status: 400 })
    }
  }

  await prisma.user.delete({ where: { id } })
  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'user.deleted', entityType: 'user', entityId: id, entityLabel: existing.email, ipAddress: getIp(req) }))
  return NextResponse.json({ success: true })
}
