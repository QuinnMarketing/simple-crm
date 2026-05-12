import crypto from 'crypto'

function hash(value: string) {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

export interface FacebookConfig {
  pixelId: string
  accessToken: string
}

export interface FacebookResult {
  success: boolean
  eventsReceived?: number
  error?: string
}

export async function pushToFacebook(
  lead: {
    name?: string
    email?: string | null
    phone?: string | null
    fbclid?: string | null
    fbp?: string | null
    fbc?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    pageUrl?: string | null
    value?: number | null
    createdAt: Date
  },
  config?: FacebookConfig
): Promise<FacebookResult> {
  const pixelId = config?.pixelId ?? process.env.FACEBOOK_PIXEL_ID
  const accessToken = config?.accessToken ?? process.env.FACEBOOK_ACCESS_TOKEN

  if (!pixelId || !accessToken) {
    return { success: false, error: 'Facebook CAPI credentials not configured' }
  }

  const userData: Record<string, string | string[]> = {}
  if (lead.email) userData.em = [hash(lead.email)]
  if (lead.phone) userData.ph = [hash(lead.phone.replace(/\D/g, ''))]
  if (lead.name) {
    const parts = lead.name.trim().split(/\s+/)
    userData.fn = [hash(parts[0])]
    if (parts.length > 1) userData.ln = [hash(parts.slice(1).join(' '))]
  }
  if (lead.fbp) userData.fbp = lead.fbp
  if (lead.fbc) userData.fbc = lead.fbc
  if (lead.ipAddress) userData.client_ip_address = lead.ipAddress
  if (lead.userAgent) userData.client_user_agent = lead.userAgent

  const event: Record<string, unknown> = {
    event_name: 'Lead',
    event_time: Math.floor(lead.createdAt.getTime() / 1000),
    action_source: 'website',
    user_data: userData,
  }
  if (lead.pageUrl) event.event_source_url = lead.pageUrl
  if (lead.value) event.custom_data = { value: lead.value, currency: 'AUD' }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: accessToken }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: JSON.stringify(data) }
    return { success: true, eventsReceived: data.events_received }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
