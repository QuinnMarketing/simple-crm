import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'team'); if (gate) return gate

  const accountParam = req.nextUrl.searchParams.get('account') ?? undefined
  const filter = getAccountFilter(session.user, accountParam)

  const members = await prisma.teamMember.findMany({
    where: filter,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(members)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'team'); if (gate) return gate

  const body = await req.json()
  const { accountParam, name, role, bio, photoUrl } = body

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const count = await prisma.teamMember.count({ where: { accountId } })
  const member = await prisma.teamMember.create({
    data: {
      accountId,
      name: String(name).trim().slice(0, 120),
      role: role ? String(role).trim().slice(0, 100) : null,
      bio: bio ? String(bio).trim().slice(0, 1000) : null,
      photoUrl: photoUrl ? String(photoUrl).trim().slice(0, 2000) : null,
      sortOrder: count,
    },
  })
  return NextResponse.json(member, { status: 201 })
}
