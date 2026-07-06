import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getAdminSmtp } from '@/lib/email-from'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { getBaseUrl } from '@/lib/base-url'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // 5 requests per IP and 3 per target email per 15 minutes
  const ip = getClientIp(req)
  if (!rateLimit(`ml:ip:${ip}`, 5, 15 * 60_000) || !rateLimit(`ml:email:${email.toLowerCase().trim()}`, 3, 15 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
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

  const magicUrl = `${getBaseUrl()}/magic-link?token=${token}`

  const smtp = getAdminSmtp()

  if (smtp.host && smtp.user && smtp.pass) {
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
