import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

// One-shot master-admin credential reset. Auth is the ADMIN_TOKEN bearer only
// (no session) so it can bootstrap a locked-out admin. Fails closed when
// ADMIN_TOKEN is unset. Intended to be removed after use.
export const maxDuration = 30

function tokenOk(req: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const a = Buffer.from(provided), b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, password } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'email and password (min 8) required' }, { status: 400 })
  }
  const normEmail = email.toLowerCase().trim()
  const hash = await bcrypt.hash(password, 12)

  // 1. Target email already exists → promote to master admin + set password
  const byEmail = await prisma.user.findUnique({ where: { email: normEmail } })
  if (byEmail) {
    await prisma.user.update({ where: { email: normEmail }, data: { role: 'master_admin', accountId: null, password: hash } })
    return NextResponse.json({ ok: true, action: 'updated-existing', email: normEmail })
  }

  // 2. Rename the current master admin (oldest) to the new email + password
  const current = await prisma.user.findFirst({ where: { role: 'master_admin' }, orderBy: { createdAt: 'asc' } })
  if (current) {
    await prisma.user.update({ where: { id: current.id }, data: { email: normEmail, password: hash, accountId: null } })
    return NextResponse.json({ ok: true, action: 'renamed', email: normEmail, previousEmail: current.email })
  }

  // 3. No master admin yet → create one
  await prisma.user.create({ data: { email: normEmail, password: hash, name: 'Master Admin', role: 'master_admin', accountId: null } })
  return NextResponse.json({ ok: true, action: 'created', email: normEmail })
}
