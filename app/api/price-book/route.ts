import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const accountParam = searchParams.get('account') ?? undefined
  const filter = getAccountFilter(session.user, accountParam)

  const items = await prisma.priceItem.findMany({
    where: filter,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountParam, name, description, price, unit, category, sku } = body

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (price == null || isNaN(parseFloat(price))) return NextResponse.json({ error: 'Valid price required' }, { status: 400 })

  const item = await prisma.priceItem.create({
    data: {
      accountId,
      name: String(name).trim().slice(0, 200),
      description: description ? String(description).slice(0, 1000) : null,
      price: parseFloat(price),
      unit: String(unit || 'each').slice(0, 50),
      category: category ? String(category).trim().slice(0, 100) : null,
      sku: sku ? String(sku).trim().slice(0, 100) : null,
    },
  })

  return NextResponse.json(item, { status: 201 })
}
