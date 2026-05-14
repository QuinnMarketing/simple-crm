import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { logAudit, getIp } from '@/lib/audit'
import { generateInvoicePdf } from '@/lib/pdf-invoice'
import { after } from 'next/server'
import nodemailer from 'nodemailer'
import type { SmtpConfig } from '@/lib/email'
import { mergeSmtp } from '@/lib/platform-defaults'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

async function getSmtp(accountId: string): Promise<SmtpConfig | null> {
  const row = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'email_smtp' } },
  })
  const saved = row?.enabled ? (() => { try { return JSON.parse(row.config) as SmtpConfig } catch { return null } })() : null
  const cfg = mergeSmtp(saved)
  return cfg.host && cfg.user && cfg.pass ? cfg : null
}

// GET — check whether SMTP is configured for this lead's account
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const lead = await prisma.lead.findFirst({ where: { id, ...filter }, select: { accountId: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const smtp = lead.accountId ? await getSmtp(lead.accountId) : null
  return NextResponse.json({ smtpEnabled: !!(smtp?.host && smtp?.user && smtp?.pass) })
}

// POST — send an email to the lead, optionally attaching a quote/invoice PDF
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const lead = await prisma.lead.findFirst({
    where: { id, ...filter },
    include: {
      account: {
        select: {
          name: true, abn: true, businessAddress: true,
          businessPhone: true, businessEmail: true, businessWebsite: true,
        },
      },
    },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!lead.accountId) return NextResponse.json({ error: 'No account associated with this lead' }, { status: 400 })

  const smtp = await getSmtp(lead.accountId)
  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    return NextResponse.json(
      { error: 'SMTP not configured. Set up email in Settings → Integrations.' },
      { status: 400 }
    )
  }

  const body = await req.json() as { to?: string; subject?: string; body?: string; quoteId?: string }
  const { to, subject, quoteId } = body
  const text = body.body ?? ''

  if (!to?.trim()) return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })

  // Build PDF attachment if a quoteId was provided
  let attachment: { filename: string; content: Buffer } | null = null
  if (quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, leadId: id },
    })
    if (quote) {
      try {
        const buffer = await generateInvoicePdf({
          quote,
          lead: { name: lead.name, email: lead.email, phone: lead.phone, address: lead.address, service: lead.service },
          business: {
            accountName: lead.account?.name ?? '',
            abn: lead.account?.abn,
            businessAddress: lead.account?.businessAddress,
            businessPhone: lead.account?.businessPhone,
            businessEmail: lead.account?.businessEmail,
            businessWebsite: lead.account?.businessWebsite,
          },
        })
        attachment = { filename: `${quote.number}.pdf`, content: buffer }
      } catch (e) {
        console.error('PDF generation failed for email attachment:', e)
      }
    }
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: parseInt(smtp.port, 10) || 587,
    secure: parseInt(smtp.port, 10) === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  try {
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to: to.trim(),
      subject: subject?.trim() || '(no subject)',
      text,
      html: text.replace(/\n/g, '<br>'),
      ...(attachment ? { attachments: [attachment] } : {}),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Send failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  const auditChanges: Record<string, unknown> = {
    subject: subject?.trim() || '(no subject)',
    to: to.trim(),
  }
  if (attachment) auditChanges.attachment = attachment.filename

  after(() =>
    logAudit({
      accountId: lead.accountId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'lead.email_sent',
      entityType: 'lead',
      entityId: id,
      entityLabel: lead.name,
      changes: auditChanges,
      ipAddress: getIp(req),
    })
  )

  return NextResponse.json({ success: true })
}
