import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { generateReviewReply } from '@/lib/ai-review-reply'

export const maxDuration = 60

// Generates a suggested reply for one review WITHOUT saving or posting it —
// the UI drops it into the reply box for the user to edit and send
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const review = await prisma.review.findUnique({ where: { id } })
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rawFilter = getAccountFilter(session.user)
  if (typeof rawFilter.accountId === 'string' && rawFilter.accountId !== review.accountId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (typeof rawFilter.accountId === 'object' && 'in' in rawFilter.accountId) {
    if (!rawFilter.accountId.in.includes(review.accountId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const [settings, account] = await Promise.all([
    prisma.reviewSettings.findUnique({ where: { accountId: review.accountId } }),
    prisma.account.findUnique({ where: { id: review.accountId }, select: { name: true } }),
  ])
  let toneGuides: { positive?: string; neutral?: string; negative?: string } = {}
  if (settings?.replyTemplates) {
    try { toneGuides = JSON.parse(settings.replyTemplates) } catch { /* ignore */ }
  }
  const toneGuide = review.rating >= 4
    ? toneGuides.positive?.trim() || undefined
    : review.rating === 3
      ? toneGuides.neutral?.trim() || undefined
      : toneGuides.negative?.trim() || undefined

  try {
    const reply = await generateReviewReply({
      reviewerName: review.reviewerName,
      rating: review.rating,
      reviewText: review.body,
      businessName: account?.name ?? 'our business',
      toneGuide,
    })
    return NextResponse.json({ reply })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `AI draft failed: ${msg}` }, { status: 502 })
  }
}
