import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountFilter } from '@/lib/account-scope'
import * as GoogleAds from '@/lib/ads/google-ads-api'
import * as MetaAds from '@/lib/ads/meta-ads'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'ads'); if (gate) return gate
  const { searchParams } = req.nextUrl
  const accountId = searchParams.get('account')
  const platform = searchParams.get('platform')
  const status = searchParams.get('status')
  const filter = getAccountFilter(session.user, accountId)

  const campaigns = await prisma.adCampaign.findMany({
    where: {
      ...filter,
      ...(platform ? { platform } : {}),
      ...(status ? { status } : {}),
    },
    include: { adPlatformAccount: { select: { platformAccountName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ campaigns })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'ads'); if (gate) return gate
  const body = await req.json()
  const { adPlatformAccountId, name, objective, budgetType, budgetAmount, startDate, endDate, headline, primaryText, destinationUrl, callToAction, imageUrl } = body as {
    adPlatformAccountId: string
    name: string
    objective: string
    budgetType: 'daily' | 'lifetime'
    budgetAmount: number
    startDate: string
    endDate?: string
    headline?: string
    primaryText?: string
    destinationUrl?: string
    callToAction?: string
    imageUrl?: string
  }

  const adAcct = await prisma.adPlatformAccount.findUnique({ where: { id: adPlatformAccountId } })
  if (!adAcct) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(adAcct.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (adAcct.platform === 'google_ads') {
      if (!adAcct.refreshToken) return NextResponse.json({ error: 'No refresh token' }, { status: 400 })
      const dt = adAcct.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
      const platformId = await GoogleAds.createCampaign(adAcct.refreshToken, adAcct.platformAccountId, {
        name,
        objective,
        budgetAmountMicros: Math.round(budgetAmount * 1_000_000),
        budgetType,
        startDate,
        endDate,
      }, dt)

      const campaign = await prisma.adCampaign.create({
        data: {
          accountId: adAcct.accountId,
          adPlatformAccountId,
          platform: 'google_ads',
          platformCampaignId: platformId,
          name,
          status: 'paused',
          objective,
          budgetType,
          budgetAmount,
          startDate,
          endDate,
          syncedAt: new Date(),
        },
      })
      return NextResponse.json({ campaign })
    }

    if (adAcct.platform === 'meta_ads') {
      if (!adAcct.accessToken) return NextResponse.json({ error: 'No access token' }, { status: 400 })

      const platformId = await MetaAds.createCampaign(adAcct.accessToken, adAcct.platformAccountId, {
        name,
        objective,
        status: 'PAUSED',
        ...(budgetType === 'daily' ? { dailyBudget: budgetAmount } : { lifetimeBudget: budgetAmount }),
        startTime: startDate,
        stopTime: endDate,
      })

      // Optionally create a basic ad set + ad if creative was provided
      let adSetId: string | undefined
      if (destinationUrl && headline) {
        const today = new Date().toISOString().split('T')[0]
        adSetId = await MetaAds.createAdSet(adAcct.accessToken, adAcct.platformAccountId, {
          campaignId: platformId,
          name: `${name} — Ad Set`,
          billingEvent: 'IMPRESSIONS',
          optimizationGoal: objective === 'leads' ? 'LEAD_GENERATION' : 'LINK_CLICKS',
          dailyBudget: budgetType === 'daily' ? budgetAmount : undefined,
          targeting: { geo_locations: { countries: ['AU'] }, age_min: 18, age_max: 65 },
          startTime: startDate ?? today,
          endTime: endDate,
        })

        if (adSetId && primaryText) {
          await MetaAds.createAd(adAcct.accessToken, adAcct.platformAccountId, {
            adSetId,
            name: `${name} — Ad`,
            headline,
            body: primaryText,
            imageUrl,
            destinationUrl,
            callToAction,
          })
        }
      }

      const campaign = await prisma.adCampaign.create({
        data: {
          accountId: adAcct.accountId,
          adPlatformAccountId,
          platform: 'meta_ads',
          platformCampaignId: platformId,
          name,
          status: 'paused',
          objective,
          budgetType,
          budgetAmount,
          startDate,
          endDate,
          syncedAt: new Date(),
        },
      })
      return NextResponse.json({ campaign })
    }

    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
