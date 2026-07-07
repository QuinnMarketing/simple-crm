import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Throttle to stop reset-token brute forcing (forgot-password is already limited)
  const ip = getClientIp(req)
  if (!rateLimit(`rp:ip:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const record = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!record) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } })
    return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { password: await bcrypt.hash(password, 12) },
  })

  await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } })

  return NextResponse.json({ ok: true })
}
