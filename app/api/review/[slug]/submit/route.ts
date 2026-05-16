import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, SmtpConfig } from '@/lib/email'

async function getSmtp(accountId: string): Promise<SmtpConfig | null> {
  const sysHost = process.env.SYSTEM_SMTP_HOST
  if (sysHost && process.env.SYSTEM_SMTP_USER && process.env.SYSTEM_SMTP_PASS) {
    return { host: sysHost, port: process.env.SYSTEM_SMTP_PORT ?? '587', user: process.env.SYSTEM_SMTP_USER, pass: process.env.SYSTEM_SMTP_PASS, from: process.env.SYSTEM_SMTP_FROM ?? process.env.SYSTEM_SMTP_USER }
  }
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'email_smtp' } },
  })
  if (!integration?.enabled) return null
  try {
    const cfg = JSON.parse(integration.config) as Partial<SmtpConfig>
    if (cfg.host && cfg.user && cfg.pass) return { host: cfg.host, port: cfg.port ?? '587', user: cfg.user, pass: cfg.pass, from: cfg.from }
  } catch { /* ignore */ }
  return null
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

  const account = await prisma.account.findUnique({
    where: { slug },
    include: { reviewSettings: true },
  })

  if (!account || !account.reviewSettings?.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { reviewerName, reviewerEmail, rating, body: reviewBody } = body ?? {}

  if (!reviewerName?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'Rating required (1-5)' }, { status: 400 })

  const settings = account.reviewSettings
  const autoApprove = settings.autoApprove
  const autoReply = settings.autoReply

  let replyText: string | null = null
  if (autoReply) {
    try {
      const templates = JSON.parse(settings.replyTemplates) as Record<string, string>
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
