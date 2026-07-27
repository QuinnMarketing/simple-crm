import { logAudit } from '@/lib/audit'
import { runAutomations } from '@/lib/automations'
import { sendPushToAccount } from '@/lib/push'
import { appendLeadToSheet } from '@/lib/google-sheets'
import { syncLeadToTrackingSheet } from '@/lib/lead-tracking-sheet'
import { prisma } from '@/lib/prisma'
import { parseWebhookPayload } from '@/lib/webhook-parser'
import { deriveLeadSource } from '@/lib/lead-source'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

// Some platforms (Elementor, WPForms, etc.) ping with GET to verify the URL
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  const contentType = req.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      body = Object.fromEntries(new URLSearchParams(text).entries())
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      body = Object.fromEntries(
        Array.from(formData.entries()).map(([k, v]) => [k, v.toString()])
      )
    } else {
      body = await req.json()
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Token-based auth: /api/webhooks/form?token=<webhookToken>
  const token = req.nextUrl.searchParams.get('token')
  let accountId: string | null = null

  // The webhook token lives in public form HTML, so it's not a secret —
  // throttle to stop a flood of junk leads. Per-IP catches a single abuser;
  // the per-token ceiling catches distributed bot floods against one account.
  const ip = getClientIp(req)
  if (!rateLimit(`form:ip:${ip}`, 20, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  if (token && !rateLimit(`form:token:${token}`, 120, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (token) {
    const account = await prisma.account.findUnique({
      where: { webhookToken: token, isActive: true },
      select: { id: true },
    })
    if (!account) {
      return NextResponse.json({ error: 'Invalid or inactive webhook token' }, { status: 401 })
    }
    accountId = account.id
  } else {
    // Legacy: fall back to WEBHOOK_SECRET header check (no account scoping).
    // If no secret is configured either, reject — never accept anonymous leads.
    const secret = process.env.WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Missing webhook token' }, { status: 401 })
    }
    const header = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')
    if (header !== secret && header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Honeypot: real users never fill these hidden fields — bots do. Silently
  // accept (200) so the bot thinks it succeeded, but create no lead.
  const HONEYPOTS = ['_gotcha', 'honeypot', 'hp', 'url_website', 'confirm_email']
  if (HONEYPOTS.some((k) => typeof body[k] === 'string' && (body[k] as string).trim() !== '')) {
    return NextResponse.json({ success: true })
  }

  const parsed = parseWebhookPayload(body)

  // Drop nameless/contactless submissions — almost always junk
  if (!parsed.name?.trim() && !parsed.email && !parsed.phone) {
    return NextResponse.json({ success: true })
  }

  // Dedupe: skip an identical submission (same account + email/phone) seen in
  // the last 5 minutes — stops double-submits and simple flood loops.
  if (accountId && (parsed.email || parsed.phone)) {
    const recent = await prisma.lead.findFirst({
      where: {
        accountId,
        createdAt: { gt: new Date(Date.now() - 5 * 60_000) },
        OR: [
          ...(parsed.email ? [{ email: parsed.email }] : []),
          ...(parsed.phone ? [{ phone: parsed.phone }] : []),
        ],
      },
      select: { id: true },
    })
    if (recent) return NextResponse.json({ success: true, leadId: recent.id, deduped: true })
  }

  const lead = await prisma.lead.create({
    data: {
      name: parsed.name,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      address: parsed.address ?? null,
      service: parsed.service ?? null,
      notes: parsed.notes ?? null,
      source: deriveLeadSource(parsed) ?? 'webhook',
      status: 'new',
      gclid: parsed.gclid ?? null,
      fbclid: parsed.fbclid ?? null,
      fbp: parsed.fbp ?? null,
      fbc: parsed.fbc ?? null,
      utmSource: parsed.utmSource ?? null,
      utmMedium: parsed.utmMedium ?? null,
      utmCampaign: parsed.utmCampaign ?? null,
      utmTerm: parsed.utmTerm ?? null,
      utmContent: parsed.utmContent ?? null,
      utmMatchtype: parsed.utmMatchtype ?? null,
      pageUrl: parsed.pageUrl ?? null,
      formData: parsed.formData,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
      accountId,
    },
  })

  after(() => appendLeadToSheet(lead))
  after(() => syncLeadToTrackingSheet(accountId, lead))
  after(() => runAutomations('lead_created', lead))
  after(() => logAudit({ accountId, action: 'lead.created', entityType: 'lead', entityId: lead.id, entityLabel: lead.name, ipAddress: lead.ipAddress }))
  after(() => sendPushToAccount(accountId, {
    title: `New Lead: ${lead.name}`,
    body: [lead.service, lead.source].filter(Boolean).join(' · ') || 'Submitted via website form',
    url: `/leads/${lead.id}`,
  }))

  // Return 200 (not 201) — some platforms treat anything other than 200 as an error
  return NextResponse.json({ success: true, leadId: lead.id })
}
