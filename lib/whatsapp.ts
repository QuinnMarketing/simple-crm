import { prisma } from './prisma'

const GRAPH_API = 'https://graph.facebook.com/v20.0'

export interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  wabaId?: string
}

export async function getWhatsAppConfig(accountId: string): Promise<WhatsAppConfig | null> {
  const row = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'whatsapp' } },
  })
  if (!row?.enabled) return null
  try {
    const cfg = JSON.parse(row.config) as Partial<WhatsAppConfig>
    if (!cfg.phoneNumberId || !cfg.accessToken) return null
    return { phoneNumberId: cfg.phoneNumberId, accessToken: cfg.accessToken, wabaId: cfg.wabaId }
  } catch {
    return null
  }
}

export type SendResult = { waMessageId?: string; error?: string }

/**
 * Sends a freeform text message. Only valid within 24h of the customer's
 * last inbound message — outside that window (or for the very first
 * contact) WhatsApp requires an approved template message instead.
 */
export async function sendWhatsAppText(config: WhatsAppConfig, to: string, body: string): Promise<SendResult> {
  const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    }),
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    return { error: data.error?.message ?? `WhatsApp API error ${res.status}` }
  }
  return { waMessageId: data.messages?.[0]?.id }
}

/** Normalizes a lead's stored phone number to WhatsApp's expected format (digits only, no +/spaces/dashes). */
export function normalizeWaNumber(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

/**
 * WhatsApp's "from" is always international-format digits (e.g. 61412345678),
 * while leads are often stored in local AU format (0412 345 678) or with
 * punctuation. Compare by the last 9 digits (AU mobile number length) rather
 * than requiring an exact match.
 */
export function phonesLikelyMatch(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '')
  const db = b.replace(/\D/g, '')
  if (!da || !db) return false
  return da.slice(-9) === db.slice(-9)
}
