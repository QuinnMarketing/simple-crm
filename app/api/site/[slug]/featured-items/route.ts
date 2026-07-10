import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const kindParam = req.nextUrl.searchParams.get('kind') // 'product' | 'package' | omitted for both

  const account = await prisma.account.findUnique({ where: { slug }, select: { id: true } })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await prisma.featuredItem.findMany({
    where: {
      accountId: account.id,
      active: true,
      ...(kindParam ? { kind: kindParam } : {}),
    },
    select: {
      id: true, kind: true, name: true, description: true,
      priceLabel: true, imageUrl: true, ctaLabel: true, ctaHref: true,
    },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    take: 100,
  })
  return NextResponse.json({ items })
}
