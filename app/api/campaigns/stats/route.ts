import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)

  const [campaigns, opens, clicks] = await Promise.all([
    prisma.emailCampaign.aggregate({
      where: { ...filter, status: 'sent' },
      _count: { id: true },
      _sum: { totalSent: true, totalFailed: true },
    }),
    prisma.emailCampaignSend.count({
      where: {
        campaign: { ...filter, status: 'sent', trackOpens: true },
        openedAt: { not: null },
      },
    }),
    prisma.emailCampaignSend.count({
      where: {
        campaign: { ...filter, status: 'sent', trackClicks: true },
        clickedAt: { not: null },
      },
    }),
  ])

  // Denominator for rates: delivered emails from tracking-enabled campaigns only
  const [openDenominator, clickDenominator] = await Promise.all([
    prisma.emailCampaign.aggregate({
      where: { ...filter, status: 'sent', trackOpens: true },
      _sum: { totalSent: true },
    }),
    prisma.emailCampaign.aggregate({
      where: { ...filter, status: 'sent', trackClicks: true },
      _sum: { totalSent: true },
    }),
  ])

  const totalSent = campaigns._sum.totalSent ?? 0
  const totalFailed = campaigns._sum.totalFailed ?? 0
  const sentCampaigns = campaigns._count.id

  const openBase = openDenominator._sum.totalSent ?? 0
  const clickBase = clickDenominator._sum.totalSent ?? 0

  return NextResponse.json({
    sentCampaigns,
    totalDelivered: totalSent,
    totalFailed,
    totalOpens: opens,
    totalClicks: clicks,
    openRate: openBase > 0 ? Math.round((opens / openBase) * 100) : null,
    clickRate: clickBase > 0 ? Math.round((clicks / clickBase) * 100) : null,
  })
}
