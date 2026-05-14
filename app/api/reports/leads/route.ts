import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountParam = searchParams.get('account') ?? undefined
  const accountFilter = getAccountFilter(session.user, accountParam)

  const leads = await prisma.lead.findMany({
    where: {
      ...accountFilter,
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    select: {
      id: true, name: true, email: true, status: true, source: true,
      value: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const sourceMap: Record<string, number> = {}
  const statusMap: Record<string, number> = {}
  const valueByStatus: Record<string, number> = {}
  let totalValue = 0

  for (const l of leads) {
    const src = l.source || 'unknown'
    sourceMap[src] = (sourceMap[src] ?? 0) + 1
    statusMap[l.status] = (statusMap[l.status] ?? 0) + 1
    if (l.value) {
      valueByStatus[l.status] = (valueByStatus[l.status] ?? 0) + l.value
      totalValue += l.value
    }
  }

  const won = statusMap['won'] ?? 0
  const lost = statusMap['lost'] ?? 0
  const total = leads.length
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0
  const wonValue = valueByStatus['won'] ?? 0
  const avgDeal = won > 0 ? Math.round(wonValue / won) : 0

  const bySource = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  const byStatus = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count, value: valueByStatus[status] ?? 0 }))

  return NextResponse.json({
    total, won, lost, conversionRate, totalValue, wonValue, avgDeal,
    bySource, byStatus,
    leads: leads.map(l => ({
      id: l.id, name: l.name, email: l.email, status: l.status,
      source: l.source, value: l.value, createdAt: l.createdAt.toISOString(),
    })),
  })
}
