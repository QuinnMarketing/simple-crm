import { prisma } from '@/lib/prisma'
import { sendEmail, SmtpConfig } from '@/lib/email'
import { mergeSmtp } from '@/lib/platform-defaults'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // 5 requests per IP and 3 per target email per 15 minutes
  const ip = getClientIp(req)
  if (!rateLimit(`fp:ip:${ip}`, 5, 15 * 60_000) || !rateLimit(`fp:email:${email.toLowerCase().trim()}`, 3, 15 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      account: {
        include: { integrations: { where: { platform: 'email_smtp', enabled: true } } },
      },
    },
  })

  // Always return the same response to avoid email enumeration
  const ok = NextResponse.json({ ok: true })
  if (!user) return ok

  // Delete any existing tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

  // Create a new token valid for 1 hour
  const token = randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password/${token}`

  let accountSmtp: Partial<SmtpConfig> | null = null
  if (user.account?.integrations?.[0]) {
    try { accountSmtp = JSON.parse(user.account.integrations[0].config) as Partial<SmtpConfig> } catch {}
  }
  const smtp = mergeSmtp(accountSmtp)

  if (smtp.host && smtp.user && smtp.pass) {
    try {
      await sendEmail(
        smtp,
        user.email,
        'Reset your Simple CRM password',
        `Hi${user.name ? ` ${user.name}` : ''},\n\nClick the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      )
    } catch {
      // Log but don't expose — token is still created so admin can share link manually
    }
  }

  return ok
}
