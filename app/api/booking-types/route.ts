import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

const PRICE_TYPES = ['fixed', 'from', 'free']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const accountParam = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountParam)

  const types = await prisma.bookingType.findMany({
    where: filter,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      addons: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      variants: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
    },
  })
  return NextResponse.json(types)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const body = await req.json()
  const accountId =
    session.user.role === 'master_admin'
      ? (body.accountId ?? null)
      : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const count = await prisma.bookingType.count({ where: { accountId } })
  const type = await prisma.bookingType.create({
    data: {
      accountId,
      name: String(body.name).trim().slice(0, 120),
      category: body.category?.trim()?.slice(0, 60) || null,
      description: body.description?.trim()?.slice(0, 500) || null,
      durationMin: Math.max(5, Math.min(1440, Number(body.durationMin) || 60)),
      price: body.price != null && body.price !== '' ? Math.max(0, Number(body.price)) : null,
      priceType: PRICE_TYPES.includes(body.priceType) ? body.priceType : 'fixed',
      bufferBefore: Math.max(0, Math.min(240, Number(body.bufferBefore) || 0)),
      bufferAfter: Math.max(0, Math.min(240, Number(body.bufferAfter) || 0)),
      color: body.color?.trim()?.slice(0, 20) || null,
      onlineBookable: body.onlineBookable !== false,
      active: body.active !== false,
      sortOrder: count,
    },
  })
  return NextResponse.json(type, { status: 201 })
}
