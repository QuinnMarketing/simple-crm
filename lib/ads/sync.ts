import { prisma } from '@/lib/prisma'
import * as GoogleAds from './google-ads-api'
import * as MetaAds from './meta-ads'

function dateSince(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
const today = () => new Date().toISOString().split('T')[0]

// ─── Google Ads sync ────────────────────────────────────────────────────────

async function syncGoogleAdsAccount(adPlatformAccountId: string) {
  const acct = await prisma.adPlatformAccount.findUnique({ where: { id: adPlatformAccountId } })
  if (!acct || !acct.refreshToken) return { synced: 0, errors: ['No refresh token'] }

  const errors: string[] = []
  let synced = 0

  try {
    const loginCustomerId = acct.loginCustomerId ?? undefined
    const campaigns = await GoogleAds.listCampaigns(
      acct.refreshToken,
      acct.platformAccountId,
      acct.developerToken ?? undefined,
      loginCustomerId
    )

    for (const c of campaigns) {
      await prisma.adCampaign.upsert({
        where: { adPlatformAccountId_platformCampaignId: { adPlatformAccountId, platformCampaignId: c.id } },
        create: {
          accountId: acct.accountId,
          adPlatformAccountId,
          platform: 'google_ads',
          platformCampaignId: c.id,
          name: c.name,
          status: c.status,
          objective: c.channelType,
          budgetType: c.budgetType,
          budgetAmount: c.budgetAmountMicros / 1_000_000,
          startDate: c.startDate,
          endDate: c.endDate,
          syncedAt: new Date(),
        },
        update: {
          name: c.name,
          status: c.status,
          budgetAmount: c.budgetAmountMicros / 1_000_000,
          startDate: c.startDate,
          endDate: c.endDate,
          syncedAt: new Date(),
        },
      })
      synced++
    }

    // Pull 30-day performance
    const metrics = await GoogleAds.getCampaignPerformance(
      acct.refreshToken,
      acct.platformAccountId,
      dateSince(30),
      today(),
      acct.developerToken ?? undefined,
      loginCustomerId
    )

    for (const m of metrics) {
      const spend = m.costMicros / 1_000_000
      const roas = spend > 0 ? m.conversionValue / spend : 0
      const cpl = m.conversions > 0 ? spend / m.conversions : 0
      const ctr = m.impressions > 0 ? m.clicks / m.impressions : 0
      const cpc = m.clicks > 0 ? spend / m.clicks : 0
      const cpm = m.impressions > 0 ? (spend / m.impressions) * 1000 : 0
      await prisma.adPerformanceSnapshot.upsert({
        where: {
          adPlatformAccountId_entityType_entityId_date: {
            adPlatformAccountId,
            entityType: 'campaign',
            entityId: m.entityId,
            date: new Date(m.date),
          },
        },
        create: {
          accountId: acct.accountId,
          adPlatformAccountId,
          platform: 'google_ads',
          entityType: 'campaign',
          entityId: m.entityId,
          date: new Date(m.date),
          impressions: m.impressions,
          clicks: m.clicks,
          spend,
          conversions: m.conversions,
          conversionValue: m.conversionValue,
          ctr,
          cpc,
          cpm,
          roas,
          cpl,
        },
        update: { impressions: m.impressions, clicks: m.clicks, spend, conversions: m.conversions, conversionValue: m.conversionValue, ctr, cpc, cpm, roas, cpl },
      })
    }
  } catch (e) {
    errors.push(String(e))
  }

  await prisma.adPlatformAccount.update({
    where: { id: adPlatformAccountId },
    data: { syncedAt: new Date() },
  })

  return { synced, errors }
}

// ─── Meta Ads sync ──────────────────────────────────────────────────────────

async function syncMetaAdsAccount(adPlatformAccountId: string) {
  const acct = await prisma.adPlatformAccount.findUnique({ where: { id: adPlatformAccountId } })
  if (!acct || !acct.accessToken) return { synced: 0, errors: ['No access token'] }

  const errors: string[] = []
  let synced = 0

  try {
    const campaigns = await MetaAds.listCampaigns(acct.accessToken, acct.platformAccountId)

    for (const c of campaigns) {
      await prisma.adCampaign.upsert({
        where: { adPlatformAccountId_platformCampaignId: { adPlatformAccountId, platformCampaignId: c.id } },
        create: {
          accountId: acct.accountId,
          adPlatformAccountId,
          platform: 'meta_ads',
          platformCampaignId: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          budgetType: c.dailyBudget ? 'daily' : 'lifetime',
          budgetAmount: c.dailyBudget ?? c.lifetimeBudget,
          startDate: c.startTime?.split('T')[0],
          endDate: c.stopTime?.split('T')[0],
          syncedAt: new Date(),
        },
        update: {
          name: c.name,
          status: c.status,
          budgetAmount: c.dailyBudget ?? c.lifetimeBudget,
          syncedAt: new Date(),
        },
      })
      synced++
    }

    // Pull insights
    const insights = await MetaAds.getInsights(
      acct.accessToken,
      acct.platformAccountId,
      dateSince(30),
      today()
    )

    for (const m of insights) {
      const roas = m.spend > 0 ? (m.actions?.['purchase'] ?? 0) / m.spend : 0
      const cpl = m.actions?.['lead'] && m.spend > 0 ? m.spend / (m.actions['lead'] ?? 1) : 0
      const ctr = m.impressions > 0 ? m.clicks / m.impressions : 0
      const cpc = m.clicks > 0 ? m.spend / m.clicks : 0
      const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0
      const conversions = (m.actions?.['lead'] ?? 0) + (m.actions?.['purchase'] ?? 0) + (m.actions?.['complete_registration'] ?? 0)
      await prisma.adPerformanceSnapshot.upsert({
        where: {
          adPlatformAccountId_entityType_entityId_date: {
            adPlatformAccountId,
            entityType: 'campaign',
            entityId: m.entityId,
            date: new Date(m.date),
          },
        },
        create: {
          accountId: acct.accountId,
          adPlatformAccountId,
          platform: 'meta_ads',
          entityType: 'campaign',
          entityId: m.entityId,
          date: new Date(m.date),
          impressions: m.impressions,
          clicks: m.clicks,
          spend: m.spend,
          conversions,
          conversionValue: 0,
          ctr,
          cpc,
          cpm,
          roas,
          cpl,
        },
        update: { impressions: m.impressions, clicks: m.clicks, spend: m.spend, conversions, ctr, cpc, cpm, roas, cpl },
      })
    }
  } catch (e) {
    errors.push(String(e))
  }

  await prisma.adPlatformAccount.update({
    where: { id: adPlatformAccountId },
    data: { syncedAt: new Date() },
  })

  return { synced, errors }
}

// ─── Public entry points ────────────────────────────────────────────────────

export async function syncAccount(adPlatformAccountId: string) {
  const acct = await prisma.adPlatformAccount.findUnique({ where: { id: adPlatformAccountId } })
  if (!acct) return { synced: 0, errors: ['Account not found'] }
  if (acct.platform === 'google_ads') return syncGoogleAdsAccount(adPlatformAccountId)
  if (acct.platform === 'meta_ads') return syncMetaAdsAccount(adPlatformAccountId)
  return { synced: 0, errors: [`Platform ${acct.platform} not yet supported`] }
}

export async function syncAllForCrmAccount(accountId: string) {
  const accounts = await prisma.adPlatformAccount.findMany({
    where: { accountId, enabled: true },
  })
  const results = await Promise.allSettled(accounts.map(a => syncAccount(a.id)))
  return results.map((r, i) => ({
    id: accounts[i].id,
    platform: accounts[i].platform,
    ...(r.status === 'fulfilled' ? r.value : { synced: 0, errors: [String((r as PromiseRejectedResult).reason)] }),
  }))
}
