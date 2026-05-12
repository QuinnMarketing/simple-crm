import { prisma } from './prisma'
import nodemailer from 'nodemailer'
import type { SmtpConfig } from './email'

const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function wrapLinksForTracking(html: string, sendId: string): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_, url) => `href="${BASE_URL}/api/track/click?s=${sendId}&u=${encodeURIComponent(url)}"`
  )
}

function buildHtml(opts: {
  bodyHtml: string
  businessName: string
  sendId: string
  trackOpens: boolean
  trackClicks: boolean
  vars: Record<string, string>
}): string {
  let body = interpolate(opts.bodyHtml, opts.vars)
  if (opts.trackClicks) body = wrapLinksForTracking(body, opts.sendId)
  const pixel = opts.trackOpens
    ? `<img src="${BASE_URL}/api/track/open?s=${opts.sendId}" width="1" height="1" style="display:none" alt="" />`
    : ''
  const unsubUrl = `${BASE_URL}/api/unsubscribe?s=${opts.sendId}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
<tr><td style="padding:40px 40px 32px;font-size:15px;line-height:1.6;color:#1e293b;">${body}</td></tr>
<tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
You received this from <strong>${opts.businessName}</strong>.<br>
<a href="${unsubUrl}" style="color:#64748b;">Unsubscribe</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
${pixel}
</body>
</html>`
}

type SegmentFilter = {
  statuses?: string[]
  sources?: string[]
  leadIds?: string[]
}

export async function sendCampaign(campaignId: string): Promise<{ sent: number; failed: number }> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { account: { select: { name: true, businessEmail: true, integrations: true } } },
  })
  if (!campaign || !campaign.accountId) throw new Error('Campaign not found')

  const smtpRow = campaign.account?.integrations.find((i) => i.platform === 'email_smtp' && i.enabled)
  const smtpConfig: SmtpConfig | null = smtpRow ? (JSON.parse(smtpRow.config) as SmtpConfig) : null
  if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
    throw new Error('SMTP not configured — add email settings in Integrations')
  }

  const filter: SegmentFilter = campaign.segmentFilter ? JSON.parse(campaign.segmentFilter) : {}

  // Build lead query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    accountId: campaign.accountId,
    email: { not: null },
    unsubscribed: false,
  }
  if (filter.statuses?.length) where.status = { in: filter.statuses }
  if (filter.sources?.length) where.source = { in: filter.sources }
  if (filter.leadIds?.length) where.id = { in: filter.leadIds }

  const leads = await prisma.lead.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true, service: true, source: true, status: true },
  })

  await prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: 'sending' } })

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port, 10) || 587,
    secure: parseInt(smtpConfig.port, 10) === 465,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  })

  let sent = 0
  let failed = 0
  const businessName = campaign.account?.name ?? smtpConfig.from ?? smtpConfig.user

  for (const lead of leads) {
    if (!lead.email) continue

    const sendRecord = await prisma.emailCampaignSend.create({
      data: {
        campaignId,
        leadId: lead.id,
        email: lead.email,
        name: lead.name,
        status: 'pending',
      },
    })

    const vars: Record<string, string> = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone ?? '',
      service: lead.service ?? '',
      source: lead.source ?? '',
      status: lead.status,
      business_name: businessName,
    }

    try {
      const subject = interpolate(campaign.subject, vars)
      const html = buildHtml({
        bodyHtml: campaign.bodyHtml,
        businessName,
        sendId: sendRecord.id,
        trackOpens: campaign.trackOpens,
        trackClicks: campaign.trackClicks,
        vars,
      })
      const text = interpolate(campaign.bodyText || campaign.bodyHtml.replace(/<[^>]+>/g, ''), vars)

      await transporter.sendMail({
        from: smtpConfig.from || smtpConfig.user,
        to: lead.email,
        subject,
        html,
        text,
      })

      await prisma.emailCampaignSend.update({
        where: { id: sendRecord.id },
        data: { status: 'sent', sentAt: new Date() },
      })
      sent++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await prisma.emailCampaignSend.update({
        where: { id: sendRecord.id },
        data: { status: 'failed', error: msg },
      })
      failed++
    }
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'sent', sentAt: new Date(), totalSent: sent, totalFailed: failed },
  })

  return { sent, failed }
}
