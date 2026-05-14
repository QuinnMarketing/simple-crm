import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { fetchGA4Data } from '@/lib/google-analytics'
import { mergeGoogleAds } from '@/lib/platform-defaults'
import { NextRequest, NextResponse } from 'next/server'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

async function getGoogleAdsToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Google Ads token refresh failed')
  return (await res.json()).access_token
}

async function fetchGoogleAdsData(cfg: Record<string, string>, days: number) {
  const token = await getGoogleAdsToken(cfg.clientId, cfg.clientSecret, cfg.refreshToken)
  const customerId = cfg.customerId.replace(/-/g, '')

  const now = new Date()
  const start = new Date(now.getTime() - days * 86_400_000)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const query = `SELECT campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${fmt(start)}' AND '${fmt(now)}' AND campaign.status != 'REMOVED' ORDER BY metrics.impressions DESC LIMIT 50`

  const res = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': cfg.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  )
  if (!res.ok) throw new Error(`Google Ads API error: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0
  const campaigns: { name: string; status: string; impressions: number; clicks: number; spend: number; conversions: number }[] = []

  for (const row of data.results ?? []) {
    const spend = (parseInt(row.metrics?.costMicros ?? '0') || 0) / 1_000_000
    const impressions = parseInt(row.metrics?.impressions ?? '0') || 0
    const clicks = parseInt(row.metrics?.clicks ?? '0') || 0
    const conversions = parseFloat(String(row.metrics?.conversions ?? '0')) || 0
    totalSpend += spend
    totalImpressions += impressions
    totalClicks += clicks
    totalConversions += conversions
    campaigns.push({
      name: row.campaign?.name ?? 'Unknown',
      status: row.campaign?.status ?? 'UNKNOWN',
      impressions, clicks, spend, conversions,
    })
  }

  return { spend: totalSpend, impressions: totalImpressions, clicks: totalClicks, conversions: totalConversions, campaigns }
}

async function fetchMetaAdsData(accessToken: string, adAccountId: string, days: number) {
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const preset = days <= 7 ? 'last_7_days' : days <= 30 ? 'last_30_days' : 'last_90_days'

  const params = new URLSearchParams({
    access_token: accessToken,
    level: 'campaign',
    fields: 'campaign_name,spend,impressions,clicks,actions',
    date_preset: preset,
    limit: '100',
  })

  const res = await fetch(`https://graph.facebook.com/v20.0/${accountId}/insights?${params}`)
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalLeads = 0
  const campaigns: { name: string; spend: number; impressions: number; clicks: number; leads: number }[] = []

  for (const row of data.data ?? []) {
    const spend = parseFloat(row.spend ?? '0') || 0
    const impressions = parseInt(row.impressions ?? '0') || 0
    const clicks = parseInt(row.clicks ?? '0') || 0
    const leadAction = (row.actions as { action_type: string; value: string }[] | undefined)
      ?.find((a) => a.action_type === 'lead')
    const leads = parseInt(leadAction?.value ?? '0') || 0
    totalSpend += spend
    totalImpressions += impressions
    totalClicks += clicks
    totalLeads += leads
    campaigns.push({ name: row.campaign_name ?? 'Unknown', spend, impressions, clicks, leads })
  }

  return { spend: totalSpend, impressions: totalImpressions, clicks: totalClicks, leads: totalLeads, campaigns }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30'), 1), 90)
  const accountFilter = getAccountFilter(session.user)

  const accountId =
    session.user.role === 'master_admin'
      ? (searchParams.get('account') ?? null)
      : (session.user.accountId ?? null)

  const startDate = new Date(Date.now() - days * 86_400_000)

  const [leadsRaw, integrations] = await Promise.all([
    prisma.lead.findMany({
      where: { ...accountFilter, createdAt: { gte: startDate } },
      select: { source: true, createdAt: true },
    }),
    accountId
      ? prisma.accountIntegration.findMany({ where: { accountId, enabled: true } })
      : Promise.resolve([]),
  ])

  const configs: Record<string, Record<string, string>> = {}
  for (const i of integrations) {
    try { configs[i.platform] = JSON.parse(i.config) } catch { configs[i.platform] = {} }
  }

  // Aggregate CRM leads
  const sourceMap: Record<string, number> = {}
  const dayMap: Record<string, number> = {}
  for (const lead of leadsRaw) {
    const src = lead.source ?? 'direct'
    sourceMap[src] = (sourceMap[src] ?? 0) + 1
    const day = lead.createdAt.toISOString().split('T')[0]
    dayMap[day] = (dayMap[day] ?? 0) + 1
  }
  const byDay = Array.from({ length: days }, (_, i) => {
    const date = new Date(startDate.getTime() + i * 86_400_000).toISOString().split('T')[0]
    return { date, count: dayMap[date] ?? 0 }
  })
  const crmLeads = {
    total: leadsRaw.length,
    bySource: Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    byDay,
  }

  const [ga4, googleAds, metaAds] = await Promise.all([
    (async () => {
      const cfg = configs.google_analytics
      if (!cfg?.refreshToken || !cfg?.propertyId) return null
      try { return await fetchGA4Data(cfg.refreshToken, cfg.propertyId, days) } catch { return null }
    })(),
    (async () => {
      const cfg = mergeGoogleAds(configs.google_ads)
      if (!cfg.developerToken || !cfg.customerId || !cfg.refreshToken || !cfg.clientId || !cfg.clientSecret) return null
      try { return await fetchGoogleAdsData(cfg, days) } catch { return null }
    })(),
    (async () => {
      const cfg = configs.facebook
      if (!cfg?.accessToken || !cfg?.adAccountId) return null
      try { return await fetchMetaAdsData(cfg.accessToken, cfg.adAccountId, days) } catch { return null }
    })(),
  ])

  return NextResponse.json({ period: days, crmLeads, ga4, googleAds, metaAds })
}
