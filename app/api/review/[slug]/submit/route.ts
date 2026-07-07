import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getAccountSmtp } from '@/lib/email-from'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

async function getSmtp(accountId: string) {
  const cfg = await getAccountSmtp(accountId)
  return cfg.host && cfg.user && cfg.pass ? cfg : null
}

function getReplyTemplate(templates: Record<string, string>, rating: number): string | null {
  if (rating >= 4) return templates.positive || null
  if (rating === 3) return templates.neutral || null
  return templates.negative || null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Public review submission — throttle to stop review spam / fake floods
  const ip = getClientIp(req)
  if (!rateLimit(`review:ip:${ip}`, 5, 10 * 60_000) || !rateLimit(`review:slug:${slug}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const account = await prisma.account.findUnique({
    where: { slug },
    include: { reviewSettings: true },
  })

  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (account.reviewSettings && !account.reviewSettings.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { reviewerName, reviewerEmail, rating, body: reviewBody } = body ?? {}

  if (!reviewerName?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'Rating required (1-5)' }, { status: 400 })

  const settings = account.reviewSettings
  const autoApprove = settings?.autoApprove ?? false
  const autoReply = settings?.autoReply ?? false

  let replyText: string | null = null
  if (autoReply) {
    try {
      const templates = JSON.parse(settings?.replyTemplates ?? '{}') as Record<string, string>
      replyText = getReplyTemplate(templates, rating)
    } catch { /* ignore */ }
  }

  const review = await prisma.review.create({
    data: {
      accountId: account.id,
      reviewerName: String(reviewerName).trim().slice(0, 100),
      reviewerEmail: reviewerEmail ? String(reviewerEmail).slice(0, 200) : null,
      rating: Math.max(1, Math.min(5, parseInt(rating))),
      body: reviewBody ? String(reviewBody).slice(0, 2000) : null,
      source: 'widget',
      status: autoApprove ? 'approved' : 'pending',
      reply: replyText || null,
      repliedAt: replyText ? new Date() : null,
    },
  })

  // Send auto-reply email if configured
  if (autoReply && replyText && reviewerEmail) {
    const smtp = await getSmtp(account.id)
    if (smtp) {
      await sendEmail(
        smtp,
        reviewerEmail,
        `Thank you for your review — ${account.name}`,
        `Hi ${review.reviewerName},\n\nThank you for taking the time to leave a review. Here is a message from us:\n\n${replyText}\n\nKind regards,\n${account.name}`,
      ).catch(() => {})
    }
  }

  return NextResponse.json({ success: true })
}
