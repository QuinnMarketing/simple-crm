import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
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
    select: { id: true, email: true, name: true, role: true, accountId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, password, role, accountId: bodyAccountId } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const accountId =
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

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: await bcrypt.hash(password, 12),
      role: assignedRole,
      accountId,
    },
    select: { id: true, email: true, name: true, role: true, accountId: true, createdAt: true },
  })

  after(() => logAudit({ accountId, userId: session.user.id, userEmail: session.user.email, action: 'user.created', entityType: 'user', entityId: user.id, entityLabel: user.email, ipAddress: getIp(req) }))
  return NextResponse.json(user, { status: 201 })
}
