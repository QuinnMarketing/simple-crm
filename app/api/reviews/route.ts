import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const accountParam = searchParams.get('account')
  const status = searchParams.get('status') // pending | approved | hidden
  const rating = searchParams.get('rating')

  const reviews = await prisma.review.findMany({
    where: {
      ...getAccountFilter(session.user, accountParam),
      ...(status ? { status } : {}),
      ...(rating ? { rating: { gte: parseInt(rating) } } : {}),
    },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json(reviews)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { reviewerName, reviewerEmail, rating, body: reviewBody, leadId, accountId: bodyAccountId } = body

  if (!reviewerName || !rating) return NextResponse.json({ error: 'Name and rating required' }, { status: 400 })

  const rawFilter = getAccountFilter(session.user, bodyAccountId)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })

  const review = await prisma.review.create({
    data: {
      accountId,
      leadId: leadId || null,
      reviewerName: String(reviewerName).trim().slice(0, 100),
      reviewerEmail: reviewerEmail ? String(reviewerEmail).slice(0, 200) : null,
      rating: Math.max(1, Math.min(5, parseInt(rating))),
      body: reviewBody ? String(reviewBody).slice(0, 2000) : null,
      source: 'manual',
      status: 'pending',
    },
    include: { lead: { select: { id: true, name: true } } },
  })

  return NextResponse.json(review)
}
