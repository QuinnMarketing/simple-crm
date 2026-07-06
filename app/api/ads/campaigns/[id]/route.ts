import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import * as GoogleAds from '@/lib/ads/google-ads-api'
import * as MetaAds from '@/lib/ads/meta-ads'

type P = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const campaign = await prisma.adCampaign.findUnique({
    where: { id },
    include: {
      adPlatformAccount: { select: { platformAccountName: true, platform: true } },
      adSets: { include: { ads: true } },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(campaign.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ campaign })
}

export async function PATCH(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const campaign = await prisma.adCampaign.findUnique({
    where: { id },
    include: { adPlatformAccount: true },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(campaign.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { status, budgetAmount } = body as { status?: string; budgetAmount?: number }

  try {
    // Push status change to platform
    if (status) {
      const acct = campaign.adPlatformAccount
      if (acct.platform === 'google_ads' && acct.refreshToken) {
        const dt = acct.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
        await GoogleAds.updateCampaignStatus(
          acct.refreshToken,
          acct.platformAccountId,
          campaign.platformCampaignId,
          status === 'active' ? 'ENABLED' : 'PAUSED',
          dt
        )
      } else if (acct.platform === 'meta_ads' && acct.accessToken) {
        await MetaAds.updateCampaignStatus(
          acct.accessToken,
          campaign.platformCampaignId,
          status === 'active' ? 'ACTIVE' : 'PAUSED'
        )
      }
    }

    const updated = await prisma.adCampaign.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(budgetAmount !== undefined ? { budgetAmount } : {}),
      },
    })
    return NextResponse.json({ campaign: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const campaign = await prisma.adCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(campaign.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.adCampaign.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
