import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// TEMPORARY — one-off recovery route for when master_admin login is lost and
// there's no other way in. Gated by a secret minted and set as an env var
// (not guessable, not derived from any existing credential). Delete this
// route and the CRM_BOOTSTRAP_SECRET env var once access is restored.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-bootstrap-secret')
  if (!secret || secret !== process.env.CRM_BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const hash = await bcrypt.hash(String(password), 10)
  const user = await prisma.user.upsert({
    where: { email: String(email) },
    create: { email: String(email), password: hash, name: 'Admin', role: 'master_admin' },
    update: { password: hash, role: 'master_admin' },
  })

  return NextResponse.json({ success: true, userId: user.id, email: user.email, role: user.role })
}
