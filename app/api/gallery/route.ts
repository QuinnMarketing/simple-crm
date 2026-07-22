import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'gallery'); if (gate) return gate

  const accountParam = req.nextUrl.searchParams.get('account') ?? undefined
  const filter = getAccountFilter(session.user, accountParam)

  const images = await prisma.galleryImage.findMany({
    where: filter,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(images)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'gallery'); if (gate) return gate

  const body = await req.json()
  const { accountParam, url, caption } = body

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })
  if (!url?.trim()) return NextResponse.json({ error: 'Image required' }, { status: 400 })

  const count = await prisma.galleryImage.count({ where: { accountId } })
  const image = await prisma.galleryImage.create({
    data: {
      accountId,
      url: String(url).trim().slice(0, 2000),
      caption: caption ? String(caption).trim().slice(0, 200) : null,
      sortOrder: count,
    },
  })
  return NextResponse.json(image, { status: 201 })
}
