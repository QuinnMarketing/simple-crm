import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const account = await prisma.account.findUnique({
    where: { slug },
    include: {
      reviewSettings: { select: { enabled: true, title: true, description: true, replyTemplates: true } },
    },
  })

  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Only block if settings explicitly exist AND are disabled
  if (account.reviewSettings && !account.reviewSettings.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const settings = account.reviewSettings
  let minRating = 0
  try { minRating = JSON.parse(settings?.replyTemplates ?? '{}').widgetMinRating ?? 0 } catch { /* keep 0 */ }

  const reviews = await prisma.review.findMany({
    where: {
      accountId: account.id,
      status: 'approved',
      ...(minRating > 0 ? { rating: { gte: minRating } } : {}),
    },
    select: {
      id: true,
      reviewerName: true,
      rating: true,
      body: true,
      reply: true,
      repliedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0

  return NextResponse.json({
    accountName: account.name,
    title: settings?.title ?? 'How was your experience?',
    description: settings?.description ?? null,
    averageRating: avg,
    totalReviews: reviews.length,
    reviews,
  })
}
