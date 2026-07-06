import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountFilter } from '@/lib/account-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const accountId = searchParams.get('account')
  const platform = searchParams.get('platform') // 'google_ads' | 'meta_ads' | all
  const filter = getAccountFilter(session.user, accountId)

  const where = {
    ...filter,
    OR: [
      { gclid: { not: null } },
      { fbclid: { not: null } },
    ],
    ...(platform === 'google_ads' ? { gclid: { not: null }, fbclid: null } : {}),
    ...(platform === 'meta_ads' ? { fbclid: { not: null }, gclid: null } : {}),
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      value: true,
      source: true,
      gclid: true,
      fbclid: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      utmTerm: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Enrich with campaign names from our DB if possible
  const allCampaigns = await prisma.adCampaign.findMany({
    where: filter,
    select: { platformCampaignId: true, name: true, platform: true },
  })
  const campaignByPlatformId = new Map(allCampaigns.map(c => [c.platformCampaignId, c]))

  const enriched = leads.map(lead => ({
    ...lead,
    platform: lead.gclid ? 'google_ads' : lead.fbclid ? 'meta_ads' : null,
    campaignName: lead.utmCampaign
      ? campaignByPlatformId.get(lead.utmCampaign)?.name ?? lead.utmCampaign
      : null,
  }))

  // Attribution summary
  const googleLeads = leads.filter(l => l.gclid)
  const metaLeads = leads.filter(l => l.fbclid)
  const googleValue = googleLeads.reduce((sum, l) => sum + (l.value ?? 0), 0)
  const metaValue = metaLeads.reduce((sum, l) => sum + (l.value ?? 0), 0)

  return NextResponse.json({
    leads: enriched,
    summary: {
      totalAttributed: leads.length,
      googleLeads: googleLeads.length,
      metaLeads: metaLeads.length,
      googleConversionValue: googleValue,
      metaConversionValue: metaValue,
    },
  })
}
