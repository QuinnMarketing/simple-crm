import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'master_admin') {
    return NextResponse.json({ error: 'master_admin only' }, { status: 403 })
  }

  const accountId = req.nextUrl.searchParams.get('account') ?? session.user.accountId ?? null
  if (!accountId) return NextResponse.json({ error: 'No account specified' }, { status: 400 })

  const integrations = await prisma.accountIntegration.findMany({ where: { accountId } })
  const configs: Record<string, Record<string, string>> = {}
  for (const i of integrations) {
    try { configs[i.platform] = JSON.parse(i.config) } catch { configs[i.platform] = {} }
  }

  const results: Record<string, unknown> = {}

  // Test GA4 token refresh
  const ga4cfg = configs.google_analytics
  if (ga4cfg?.refreshToken) {
    try {
      const clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID ?? process.env.GOOGLE_CALENDAR_CLIENT_ID ?? ''
      const clientSecret = process.env.GOOGLE_ANALYTICS_CLIENT_SECRET ?? process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? ''
      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ refresh_token: ga4cfg.refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) {
        results.ga4_token = { ok: false, error: tokenData }
      } else {
        // Test GA4 API call
        const apiRes = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${ga4cfg.propertyId}:runReport`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
              dimensions: [{ name: 'date' }],
              metrics: [{ name: 'sessions' }],
              limit: 1,
            }),
          }
        )
        const apiData = await apiRes.json()
        results.ga4_token = { ok: true }
        results.ga4_api = { ok: apiRes.ok, status: apiRes.status, error: apiData.error ?? null, rowCount: apiData.rowCount ?? null }
      }
    } catch (e) {
      results.ga4_token = { ok: false, error: String(e) }
    }
  } else {
    results.ga4_token = { ok: false, error: 'No refresh token' }
  }

  // Test Meta API
  const fbcfg = configs.facebook
  if (fbcfg?.accessToken && fbcfg?.adAccountId) {
    try {
      const accountIdFb = fbcfg.adAccountId.startsWith('act_') ? fbcfg.adAccountId : `act_${fbcfg.adAccountId}`
      const metaRes = await fetch(
        `https://graph.facebook.com/v20.0/${accountIdFb}/insights?access_token=${fbcfg.accessToken}&fields=spend&date_preset=last_7_days&limit=1`
      )
      const metaData = await metaRes.json()
      results.meta_api = { ok: metaRes.ok, status: metaRes.status, error: metaData.error ?? null }
    } catch (e) {
      results.meta_api = { ok: false, error: String(e) }
    }
  } else {
    results.meta_api = { ok: false, error: 'Missing accessToken or adAccountId' }
  }

  return NextResponse.json({ accountId, results })
}
