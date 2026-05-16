import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
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
