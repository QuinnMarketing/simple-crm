import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { sendEmail, SmtpConfig } from '@/lib/email'
import { postReply } from '@/lib/google-reviews'

async function getSmtpForAccount(accountId: string): Promise<SmtpConfig | null> {
  const systemHost = process.env.SYSTEM_SMTP_HOST
  if (systemHost && process.env.SYSTEM_SMTP_USER && process.env.SYSTEM_SMTP_PASS) {
    return {
      host: systemHost,
      port: process.env.SYSTEM_SMTP_PORT ?? '587',
      user: process.env.SYSTEM_SMTP_USER,
      pass: process.env.SYSTEM_SMTP_PASS,
      from: process.env.SYSTEM_SMTP_FROM ?? process.env.SYSTEM_SMTP_USER,
    }
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, reply, sendReplyEmail, accountParam } = body

  const rawFilter = getAccountFilter(session.user, accountParam)
  const existing = await prisma.review.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify access
  if (typeof rawFilter.accountId === 'string' && rawFilter.accountId !== existing.accountId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (typeof rawFilter.accountId === 'object' && 'in' in rawFilter.accountId) {
    if (!rawFilter.accountId.in.includes(existing.accountId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (reply !== undefined) {
    updateData.reply = reply || null
    updateData.repliedAt = reply ? new Date() : null
  }

  const updated = await prisma.review.update({
    where: { id },
    data: updateData,
    include: { lead: { select: { id: true, name: true } } },
  })

  // If this is a Google review and a reply was saved, post it back to GBP
  if (reply && existing.externalId && existing.source === 'google') {
    const gsa = await prisma.socialAccount.findFirst({
      where: { accountId: existing.accountId, platform: 'google_business' },
    })
    if (gsa) {
      await postReply(gsa.id, existing.externalId, reply).catch((e) =>
        console.error('GBP reply post failed:', e)
      )
    }
  }

  // Optionally email the reply to the reviewer
  if (sendReplyEmail && reply && existing.reviewerEmail) {
    const smtp = await getSmtpForAccount(existing.accountId)
    if (smtp) {
      const account = await prisma.account.findUnique({ where: { id: existing.accountId }, select: { name: true } })
      await sendEmail(
        smtp,
        existing.reviewerEmail,
        `Response to your review — ${account?.name ?? 'Our team'}`,
        `Hi ${existing.reviewerName},\n\nThank you for your review. Here is our response:\n\n${reply}\n\nKind regards,\n${account?.name ?? 'Our team'}`,
      ).catch(() => {})
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.review.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rawFilter = getAccountFilter(session.user)
  if (typeof rawFilter.accountId === 'string' && rawFilter.accountId !== existing.accountId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.review.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
