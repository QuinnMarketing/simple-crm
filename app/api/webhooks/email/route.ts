import { prisma } from '@/lib/prisma'
import { parseEmailBody, parseFromHeader } from '@/lib/email-body-parser'
import { logAudit } from '@/lib/audit'
import { runAutomations } from '@/lib/automations'
import { sendPushToAccount } from '@/lib/push'
import { NextRequest, NextResponse } from 'next/server'

// Verification ping from email services (Mailgun, SendGrid) — respond 200
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const account = await prisma.account.findUnique({
    where: { webhookToken: token, isActive: true },
    select: { id: true },
  })
  if (!account) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const accountId = account.id
  const contentType = req.headers.get('content-type') ?? ''

  let subject = ''
  let text = ''
  let html = ''
  let from = ''

  if (contentType.includes('application/json')) {
    // Postmark inbound format
    const body = await req.json() as Record<string, string>
    subject = body.Subject ?? ''
    text = body.TextBody ?? ''
    html = body.HtmlBody ?? ''
    from = body.From ?? ''
  } else {
    // Mailgun / SendGrid inbound parse — multipart/form-data
    const formData = await req.formData()
    const g = (k: string) => formData.get(k)?.toString() ?? ''
    subject = g('subject') || g('Subject')
    // Mailgun uses "body-plain" / "stripped-text"; SendGrid uses "text"
    text = g('stripped-text') || g('body-plain') || g('text')
    html = g('body-html') || g('html')
    from = g('from') || g('From') || g('sender')
  }

  const { name: fromName, email: fromEmail } = parseFromHeader(from)
  const parsed = parseEmailBody({ subject, text, html, fromEmail, fromName })

  const lead = await prisma.lead.create({
    data: {
      name: parsed.name,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      address: parsed.address ?? null,
      service: parsed.service ?? null,
      notes: parsed.notes ?? null,
      source: 'email',
      status: 'new',
      formData: parsed.rawText,
      accountId,
    },
  })

  runAutomations('lead_created', lead).catch(() => {})
  logAudit({ accountId, action: 'lead.created', entityType: 'lead', entityId: lead.id, entityLabel: lead.name, ipAddress: null }).catch(() => {})
  sendPushToAccount(accountId, {
    title: `New Lead: ${lead.name}`,
    body: [parsed.service, 'Email'].filter(Boolean).join(' · ') || 'Received via email',
    url: `/leads/${lead.id}`,
  }).catch(() => {})

  return NextResponse.json({ success: true, leadId: lead.id })
}
