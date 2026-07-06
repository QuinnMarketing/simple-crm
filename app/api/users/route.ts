import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter, isAdmin } from '@/lib/account-scope'
import bcrypt from 'bcryptjs'
import { after, NextRequest, NextResponse } from 'next/server'

const VALID_ROLES = ['master_admin', 'account_admin', 'account_user', 'admin', 'user']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountParam = req.nextUrl.searchParams.get('account')
  const accountFilter = getAccountFilter(session.user, accountParam)

  const users = await prisma.user.findMany({
    where: accountFilter,
    select: {
      id: true, email: true, name: true, role: true, accountId: true, createdAt: true,
      userAccounts: { select: { accountId: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users.map(u => ({
    ...u,
    accountIds: Array.from(new Set([...(u.accountId ? [u.accountId] : []), ...u.userAccounts.map(a => a.accountId)])),
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role, accountId: bodyAccountId, accountIds: bodyAccountIds } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const primaryAccountId: string | null =
    session.user.role === 'master_admin'
      ? (bodyAccountId ?? null)
      : (session.user.accountId ?? null)

  // master_admin can assign any role; account_admin can assign account_admin or account_user
  let assignedRole = 'account_user'
  if (session.user.role === 'master_admin') {
    assignedRole = VALID_ROLES.includes(role) ? role : 'account_user'
  } else if (session.user.role === 'account_admin' || session.user.role === 'admin') {
    assignedRole = ['account_admin', 'admin'].includes(role) ? 'account_admin' : 'account_user'
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })

  // All accounts to assign (master_admin can pass accountIds array)
  const allAccountIds: string[] = session.user.role === 'master_admin' && Array.isArray(bodyAccountIds)
    ? bodyAccountIds
    : (primaryAccountId ? [primaryAccountId] : [])

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: await bcrypt.hash(password, 12),
      role: assignedRole,
      accountId: primaryAccountId,
      userAccounts: allAccountIds.length > 0
        ? { create: allAccountIds.map(aid => ({ accountId: aid })) }
        : undefined,
    },
    select: {
      id: true, email: true, name: true, role: true, accountId: true, createdAt: true,
      userAccounts: { select: { accountId: true } },
    },
  })

  const result = {
    ...user,
    accountIds: Array.from(new Set([...(user.accountId ? [user.accountId] : []), ...user.userAccounts.map(a => a.accountId)])),
  }

  after(() => logAudit({ accountId: primaryAccountId, userId: session.user.id, userEmail: session.user.email, action: 'user.created', entityType: 'user', entityId: user.id, entityLabel: user.email, ipAddress: getIp(req) }))
  return NextResponse.json(result, { status: 201 })
}
