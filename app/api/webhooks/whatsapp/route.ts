import { prisma } from '@/lib/prisma'
import { phonesLikelyMatch } from '@/lib/whatsapp'
import { sendPushToAccount } from '@/lib/push'
import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

// Meta's one-time webhook URL verification handshake — confirms we control
// this endpoint before Meta will start delivering real events to it.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.FACEBOOK_APP_SECRET
  if (!secret || !signatureHeader) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: {
    entry?: {
      changes?: {
        value?: {
          metadata?: { phone_number_id?: string }
          messages?: { from?: string; id?: string; type?: string; text?: { body?: string } }[]
        }
      }[]
    }[]
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true }) // Meta retries on non-2xx — ack malformed bodies rather than retrying forever
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId = value?.metadata?.phone_number_id
      if (!phoneNumberId) continue

      for (const message of value?.messages ?? []) {
        if (message.type !== 'text' || !message.from || !message.text?.body) continue

        // Idempotency: Meta may retry delivery — skip if we've already stored this message
        if (message.id) {
          const existing = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: message.id } })
          if (existing) continue
        }

        const integration = await prisma.accountIntegration.findFirst({
          where: { platform: 'whatsapp', enabled: true, config: { contains: phoneNumberId } },
        })
        if (!integration) continue // message arrived for a phone number we don't recognize

        const accountId = integration.accountId
        const leads = await prisma.lead.findMany({
          where: { accountId, phone: { not: null } },
          select: { id: true, phone: true },
        })
        const matchedLead = leads.find((l) => l.phone && phonesLikelyMatch(l.phone, message.from!))

        await prisma.whatsAppMessage.create({
          data: {
            direction: 'inbound',
            body: message.text.body,
            waMessageId: message.id,
            leadId: matchedLead?.id ?? null,
            accountId,
          },
        })

        await sendPushToAccount(accountId, {
          title: '💬 WhatsApp message',
          body: message.text.body.slice(0, 100),
          url: matchedLead ? `/leads/${matchedLead.id}` : '/leads',
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
