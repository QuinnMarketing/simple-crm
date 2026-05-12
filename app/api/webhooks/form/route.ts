import { prisma } from '@/lib/prisma'
import { parseWebhookPayload } from '@/lib/webhook-parser'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  const contentType = req.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      body = Object.fromEntries(new URLSearchParams(text).entries())
    } else {
      body = await req.json()
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Token-based auth: /api/webhooks/form?token=<webhookToken>
  const token = req.nextUrl.searchParams.get('token')
  let accountId: string | null = null

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
    // Legacy: fall back to WEBHOOK_SECRET header check (no account scoping)
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const header = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')
      if (header !== secret && header !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
  }

  const parsed = parseWebhookPayload(body)

  const lead = await prisma.lead.create({
    data: {
      name: parsed.name,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      service: parsed.service ?? null,
      notes: parsed.notes ?? null,
      source: 'webhook',
      status: 'new',
      gclid: parsed.gclid ?? null,
      fbclid: parsed.fbclid ?? null,
      fbp: parsed.fbp ?? null,
      fbc: parsed.fbc ?? null,
      pageUrl: parsed.pageUrl ?? null,
      formData: parsed.formData,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
      accountId,
    },
  })

  return NextResponse.json({ success: true, leadId: lead.id }, { status: 201 })
}
