import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'target_customer'); if (gate) return gate

  const accountParam = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountParam)

  const avatars = await prisma.customerAvatar.findMany({
    where: filter,
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(avatars)
}

// Create a blank/manual persona (the AI path lives at /generate)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'target_customer'); if (gate) return gate

  const body = await req.json()
  const accountId =
    session.user.role === 'master_admin' ? (body.accountId ?? null) : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  const count = await prisma.customerAvatar.count({ where: { accountId } })
  const avatar = await prisma.customerAvatar.create({
    data: {
      accountId,
      name: body.name?.trim()?.slice(0, 120) || 'Your Ideal Customer',
      tagline: body.tagline?.trim()?.slice(0, 240) || null,
      source: 'manual',
      isPrimary: count === 0, // first persona becomes the primary shown on the dashboard
      sortOrder: count,
    },
  })
  return NextResponse.json(avatar, { status: 201 })
}
