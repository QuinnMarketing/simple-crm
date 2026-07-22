import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'

const KINDS = ['product', 'package']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'products'); if (gate) return gate

  const accountParam = req.nextUrl.searchParams.get('account') ?? undefined
  const filter = getAccountFilter(session.user, accountParam)

  const items = await prisma.featuredItem.findMany({
    where: filter,
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'products'); if (gate) return gate

  const body = await req.json()
  const { accountParam, kind, name, description, priceLabel, imageUrl, ctaLabel, ctaHref } = body

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const useKind = KINDS.includes(kind) ? kind : 'product'
  const count = await prisma.featuredItem.count({ where: { accountId, kind: useKind } })

  const item = await prisma.featuredItem.create({
    data: {
      accountId,
      kind: useKind,
      name: String(name).trim().slice(0, 160),
      description: description ? String(description).trim().slice(0, 500) : null,
      priceLabel: priceLabel ? String(priceLabel).trim().slice(0, 40) : null,
      imageUrl: imageUrl ? String(imageUrl).trim().slice(0, 2000) : null,
      ctaLabel: ctaLabel ? String(ctaLabel).trim().slice(0, 40) : null,
      ctaHref: ctaHref ? String(ctaHref).trim().slice(0, 300) : null,
      sortOrder: count,
    },
  })
  return NextResponse.json(item, { status: 201 })
}
