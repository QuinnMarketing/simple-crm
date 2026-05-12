export interface GoogleAdsConfig {
  developerToken: string
  customerId: string
  clientId: string
  clientSecret: string
  refreshToken: string
  conversionActionId: string
  qualifiedConversionActionId?: string
  wonConversionActionId?: string
}

export interface GoogleAdsResult {
  success: boolean
  error?: string
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth error: ${JSON.stringify(data)}`)
  return data.access_token
}

function toAdsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const mo = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}-${mo}-${d} ${h}:${mi}:${s}+10:00`
}

export async function pushToGoogleAds(
  lead: {
    gclid?: string | null
    value?: number | null
    createdAt: Date
  },
  config?: GoogleAdsConfig,
  options?: { conversionActionId?: string; conversionDateTime?: Date }
): Promise<GoogleAdsResult> {
  const devToken = config?.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (config?.customerId ?? process.env.GOOGLE_ADS_CUSTOMER_ID)?.replace(/-/g, '')
  const conversionActionId = options?.conversionActionId ?? config?.conversionActionId ?? process.env.GOOGLE_ADS_CONVERSION_ACTION_ID
  const clientId = config?.clientId ?? process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = config?.clientSecret ?? process.env.GOOGLE_ADS_CLIENT_SECRET
  const refreshToken = config?.refreshToken ?? process.env.GOOGLE_ADS_REFRESH_TOKEN

  if (!devToken || !customerId || !conversionActionId) {
    return { success: false, error: 'Google Ads credentials not configured' }
  }
  if (!lead.gclid) {
    return { success: false, error: 'No gclid — this lead did not come from a Google Ads click' }
  }

  try {
    const accessToken = await getAccessToken(clientId!, clientSecret!, refreshToken!)
    const conversionAction = `customers/${customerId}/conversionActions/${conversionActionId}`

    const res = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': devToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversions: [
            {
              gclid: lead.gclid,
              conversionAction,
              conversionDateTime: toAdsDateTime(options?.conversionDateTime ?? lead.createdAt),
              ...(lead.value ? { conversionValue: lead.value, currencyCode: 'AUD' } : {}),
            },
          ],
          partialFailure: true,
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) return { success: false, error: JSON.stringify(data) }
    if (data.partialFailureError) return { success: false, error: JSON.stringify(data.partialFailureError) }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
