import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const accounts = await prisma.account.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true, leads: true } } },
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, plan } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const baseSlug = toSlug(name.trim())
  let slug = baseSlug
  let i = 1
  while (await prisma.account.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`
  }

  const account = await prisma.account.create({
    data: { name: name.trim(), slug, plan: plan ?? 'starter' },
    include: { _count: { select: { users: true, leads: true } } },
  })

  return NextResponse.json(account, { status: 201 })
}
