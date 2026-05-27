import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Token refresh failed')
  return data.access_token
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'google' } },
  })
  if (!integration?.enabled) return NextResponse.json({ error: 'Google not connected' }, { status: 404 })

  let config: { refreshToken?: string; email?: string } = {}
  try { config = JSON.parse(integration.config) } catch {}
  if (!config.refreshToken) return NextResponse.json({ error: 'No refresh token stored' }, { status: 400 })

  try {
    const accessToken = await refreshAccessToken(config.refreshToken)
    const headers = { Authorization: `Bearer ${accessToken}` }

    const [adsRes, ga4Res, gscRes] = await Promise.allSettled([
      // Google Ads accessible customers
      fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
        headers: {
          ...headers,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
        },
      }),
      // GA4 account summaries (includes properties)
      fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', { headers }),
      // Search Console sites
      fetch('https://www.googleapis.com/webmasters/v3/sites', { headers }),
    ])

    const result: Record<string, unknown> = {}

    if (adsRes.status === 'fulfilled' && adsRes.value.ok) {
      const data = await adsRes.value.json()
      result.adsCustomers = (data.resourceNames ?? []).map((r: string) => ({
        resourceName: r,
        customerId: r.replace('customers/', ''),
      }))
    } else {
      result.adsCustomers = []
    }

    if (ga4Res.status === 'fulfilled' && ga4Res.value.ok) {
      const data = await ga4Res.value.json()
      result.ga4Properties = (data.accountSummaries ?? []).flatMap((acct: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }) =>
        (acct.propertySummaries ?? []).map((p) => ({
          propertyId: p.property.replace('properties/', ''),
          displayName: `${acct.displayName} — ${p.displayName}`,
        }))
      )
    } else {
      result.ga4Properties = []
    }

    if (gscRes.status === 'fulfilled' && gscRes.value.ok) {
      const data = await gscRes.value.json()
      result.gscSites = (data.siteEntry ?? []).map((s: { siteUrl: string; permissionLevel: string }) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      }))
    } else {
      result.gscSites = []
    }

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Resource fetch failed' }, { status: 500 })
  }
}
