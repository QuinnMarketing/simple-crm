export interface GA4Config {
  measurementId: string
  apiSecret: string
}

export interface GA4Result {
  success: boolean
  error?: string
}

export async function pushToGA4(
  lead: {
    name?: string
    email?: string | null
    phone?: string | null
    gclid?: string | null
    value?: number | null
    source?: string | null
  },
  config?: GA4Config
): Promise<GA4Result> {
  const measurementId = config?.measurementId ?? process.env.GOOGLE_GA4_MEASUREMENT_ID
  const apiSecret = config?.apiSecret ?? process.env.GOOGLE_GA4_API_SECRET

  if (!measurementId || !apiSecret) {
    return { success: false, error: 'GA4 credentials not configured' }
  }

  const payload = {
    client_id: `crm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    events: [
      {
        name: 'generate_lead',
        params: {
          currency: 'AUD',
          ...(lead.value ? { value: lead.value } : {}),
          ...(lead.source ? { lead_source: lead.source } : {}),
        },
      },
    ],
  }

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    return { success: res.status === 204 || res.ok }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
