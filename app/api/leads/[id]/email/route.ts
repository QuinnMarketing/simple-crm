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
import crypto from 'crypto'

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

  // Build PDF attachment + accept/reject links if a quoteId was provided
  let attachment: { filename: string; content: Buffer } | null = null
  let quoteResponseHtml = ''

  if (quoteId) {
    const existingQuote = await prisma.quote.findFirst({
      where: { id: quoteId, leadId: id },
    })
    if (existingQuote) {
      // Ensure the quote has a clientToken for one-click accept/reject
      let token = existingQuote.clientToken
      if (!token) {
        token = crypto.randomBytes(32).toString('hex')
        await prisma.quote.update({ where: { id: quoteId }, data: { clientToken: token } })
      }

      // Mark as sent if it's still in draft
      if (existingQuote.status === 'draft') {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: 'sent' } })
      }

      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
      const acceptUrl = `${baseUrl}/api/quotes/${quoteId}/respond?token=${token}&action=accept`
      const rejectUrl = `${baseUrl}/api/quotes/${quoteId}/respond?token=${token}&action=reject`

      quoteResponseHtml = `
<div style="margin:32px 0;padding:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;text-align:center;">
  <p style="font-size:14px;color:#475569;margin:0 0 20px;">Please review ${existingQuote.number} (attached) and let us know your decision:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="padding:0 8px;">
        <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">&#10003;&nbsp; Accept Quote</a>
      </td>
      <td style="padding:0 8px;">
        <a href="${rejectUrl}" style="display:inline-block;background:#ffffff;color:#dc2626;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;border:2px solid #dc2626;">&#10007;&nbsp; Decline Quote</a>
      </td>
    </tr>
  </table>
  <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">Clicking a button will instantly update your quote status.</p>
</div>`

      try {
        const buffer = await generateInvoicePdf({
          quote: existingQuote,
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
        attachment = { filename: `${existingQuote.number}.pdf`, content: buffer }
      } catch (e) {
        console.error('PDF generation failed for email attachment:', e)
      }
    }
  }

  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
  ${text.split('\n').map(line => line.trim() ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${line}</p>` : '<br/>').join('')}
  ${quoteResponseHtml}
</div>`

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
      html: htmlBody,
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
