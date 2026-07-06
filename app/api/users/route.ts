import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter, isAdmin } from '@/lib/account-scope'
import { sendEmail, SmtpConfig } from '@/lib/email'
import { mergeSmtp } from '@/lib/platform-defaults'
import { getBaseUrl } from '@/lib/base-url'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
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

  const { name, email, password, role, accountId: bodyAccountId, accountIds: bodyAccountIds, invite } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!invite && !password) {
    return NextResponse.json({ error: 'Password is required (or send an invite instead)' }, { status: 400 })
  }
  if (password && password.length < 8) {
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

  // Invited users get an unguessable placeholder — they set their own via the invite link
  const effectivePassword = password || randomBytes(32).toString('hex')

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: await bcrypt.hash(effectivePassword, 12),
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

  let inviteSent = false
  if (invite) {
    const token = randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    })
    const inviteUrl = `${getBaseUrl()}/reset-password/${token}`

    let accountSmtp: Partial<SmtpConfig> | null = null
    if (primaryAccountId) {
      const smtpRow = await prisma.accountIntegration.findUnique({
        where: { accountId_platform: { accountId: primaryAccountId, platform: 'email_smtp' } },
      })
      if (smtpRow?.enabled) {
        try { accountSmtp = JSON.parse(smtpRow.config) as Partial<SmtpConfig> } catch {}
      }
    }
    const smtp = mergeSmtp(accountSmtp)

    if (smtp.host && smtp.user && smtp.pass) {
      const inviterName = session.user.name ?? session.user.email
      try {
        await sendEmail(
          smtp,
          email,
          "You've been invited to Simple CRM",
          `Hi${name ? ` ${name}` : ''},\n\n${inviterName} has invited you to Simple CRM.\n\nClick the link below to set your password and get started. The link is valid for 7 days.\n\n${inviteUrl}\n\nOnce you've set your password, sign in at ${getBaseUrl()}/login — or use the "Email me a login link" option any time.`,
        )
        inviteSent = true
      } catch (e) {
        console.error('Invite email failed:', e)
      }
    }
  }

  const result = {
    ...user,
    accountIds: Array.from(new Set([...(user.accountId ? [user.accountId] : []), ...user.userAccounts.map(a => a.accountId)])),
    ...(invite ? { inviteSent } : {}),
  }

  after(() => logAudit({ accountId: primaryAccountId, userId: session.user.id, userEmail: session.user.email, action: invite ? 'user.invited' : 'user.created', entityType: 'user', entityId: user.id, entityLabel: user.email, ipAddress: getIp(req) }))
  return NextResponse.json(result, { status: 201 })
}
