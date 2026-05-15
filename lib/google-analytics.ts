const TOKEN_URL = 'https://oauth2.googleapis.com/token'

const GA_CLIENT_ID = () => process.env.GOOGLE_ANALYTICS_CLIENT_ID ?? process.env.GOOGLE_CALENDAR_CLIENT_ID ?? ''
const GA_CLIENT_SECRET = () => process.env.GOOGLE_ANALYTICS_CLIENT_SECRET ?? process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? ''

export function getAnalyticsAuthUrl(accountId: string): string {
  const state = Buffer.from(accountId).toString('base64url')
  const params = new URLSearchParams({
    client_id: GA_CLIENT_ID(),
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/analytics/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeAnalyticsCode(code: string): Promise<{ refreshToken: string; email?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GA_CLIENT_ID(),
      client_secret: GA_CLIENT_SECRET(),
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/analytics/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  const data = await res.json()

  let email: string | undefined
  try {
    const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    if (info.ok) email = (await info.json()).email
  } catch { /* best-effort */ }

  return { refreshToken: data.refresh_token, email }
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GA_CLIENT_ID(),
      client_secret: GA_CLIENT_SECRET(),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('GA4 token refresh failed')
  return (await res.json()).access_token
}

export interface GA4Data {
  sessions: number
  users: number
  pageViews: number
  byDay: { date: string; sessions: number; users: number }[]
}

export async function fetchGA4Data(refreshToken: string, propertyId: string, days: number): Promise<GA4Data> {
  const token = await getAccessToken(refreshToken)
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    }
  )
  if (!res.ok) throw new Error(`GA4 API error: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  let totalSessions = 0, totalUsers = 0, totalPageViews = 0
  const byDay: GA4Data['byDay'] = []

  for (const row of data.rows ?? []) {
    const sessions = parseInt(row.metricValues[0].value) || 0
    const users = parseInt(row.metricValues[1].value) || 0
    const pageViews = parseInt(row.metricValues[2].value) || 0
    totalSessions += sessions
    totalUsers += users
    totalPageViews += pageViews
    byDay.push({ date: row.dimensionValues[0].value, sessions, users })
  }

  return { sessions: totalSessions, users: totalUsers, pageViews: totalPageViews, byDay }
}
