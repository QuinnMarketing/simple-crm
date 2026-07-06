import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountFilter } from '@/lib/account-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const accountId = searchParams.get('account')
  const platform = searchParams.get('platform')
  const entityType = searchParams.get('entityType') ?? 'campaign'
  const entityId = searchParams.get('entityId')
  const since = searchParams.get('since') ?? (() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })()
  const until = searchParams.get('until') ?? new Date().toISOString().split('T')[0]

  const filter = getAccountFilter(session.user, accountId)

  const snapshots = await prisma.adPerformanceSnapshot.findMany({
    where: {
      ...filter,
      ...(platform ? { platform } : {}),
      ...(entityId ? { entityId } : {}),
      entityType,
      date: {
        gte: new Date(since),
        lte: new Date(until + 'T23:59:59Z'),
      },
    },
    orderBy: { date: 'asc' },
  })

  // Aggregate totals
  const totals = snapshots.reduce((acc, s) => ({
    impressions: acc.impressions + s.impressions,
    clicks: acc.clicks + s.clicks,
    spend: acc.spend + s.spend,
    conversions: acc.conversions + s.conversions,
    conversionValue: acc.conversionValue + s.conversionValue,
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 })

  const totalSpend = totals.spend
  const summary = {
    ...totals,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    cpc: totals.clicks > 0 ? totalSpend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totalSpend / totals.impressions) * 1000 : 0,
    roas: totalSpend > 0 ? totals.conversionValue / totalSpend : 0,
    cpl: totals.conversions > 0 ? totalSpend / totals.conversions : 0,
  }

  // Group by date for chart data
  const byDate = snapshots.reduce<Record<string, typeof totals>>((acc, s) => {
    const dateKey = s.date.toISOString().split('T')[0]
    if (!acc[dateKey]) acc[dateKey] = { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 }
    acc[dateKey].impressions += s.impressions
    acc[dateKey].clicks += s.clicks
    acc[dateKey].spend += s.spend
    acc[dateKey].conversions += s.conversions
    acc[dateKey].conversionValue += s.conversionValue
    return acc
  }, {})

  const timeSeries = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => ({ date, ...metrics }))

  // Group by entityId for entity breakdown
  const byEntity = snapshots.reduce<Record<string, typeof totals & { entityId: string }>>((acc, s) => {
    if (!acc[s.entityId]) acc[s.entityId] = { entityId: s.entityId, impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 }
    acc[s.entityId].impressions += s.impressions
    acc[s.entityId].clicks += s.clicks
    acc[s.entityId].spend += s.spend
    acc[s.entityId].conversions += s.conversions
    acc[s.entityId].conversionValue += s.conversionValue
    return acc
  }, {})

  return NextResponse.json({ summary, timeSeries, byEntity: Object.values(byEntity) })
}
