import { prisma } from '@/lib/prisma'
import { sendEmail, SmtpConfig } from '@/lib/email'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function getSystemSmtp(): SmtpConfig | null {
  const host = process.env.SYSTEM_SMTP_HOST
  const user = process.env.SYSTEM_SMTP_USER
  const pass = process.env.SYSTEM_SMTP_PASS
  if (!host || !user || !pass) return null
  return { host, port: process.env.SYSTEM_SMTP_PORT ?? '587', user, pass, from: process.env.SYSTEM_SMTP_FROM ?? user }
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      account: { include: { integrations: { where: { platform: 'email_smtp', enabled: true } } } },
    },
  })

  // Always return ok — don't reveal whether the email exists
  const ok = NextResponse.json({ ok: true })
  if (!user) return ok

  // Delete any existing magic link tokens for this user
  await prisma.magicLinkToken.deleteMany({ where: { userId: user.id } })

  const token = randomBytes(32).toString('hex')
  await prisma.magicLinkToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const magicUrl = `${baseUrl}/magic-link?token=${token}`

  let smtp = getSystemSmtp()
  if (!smtp && user.account?.integrations?.[0]) {
    try {
      const cfg = JSON.parse(user.account.integrations[0].config) as Partial<SmtpConfig>
      if (cfg.host && cfg.user && cfg.pass) smtp = { host: cfg.host, port: cfg.port ?? '587', user: cfg.user, pass: cfg.pass, from: cfg.from }
    } catch {}
  }

  if (smtp) {
    try {
      await sendEmail(
        smtp,
        user.email,
        'Your Simple CRM login link',
        `Hi${user.name ? ` ${user.name}` : ''},\n\nClick the link below to sign in. This link expires in 15 minutes and can only be used once.\n\n${magicUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      )
    } catch {}
  }

  return ok
}
