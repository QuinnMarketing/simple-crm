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

  const quotes = await prisma.quote.findMany({
    where: {
      ...accountFilter,
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const statusMap: Record<string, { count: number; total: number }> = {}
  let pipelineTotal = 0, wonTotal = 0, invoicedTotal = 0, outstandingTotal = 0

  for (const q of quotes) {
    if (!statusMap[q.status]) statusMap[q.status] = { count: 0, total: 0 }
    statusMap[q.status].count++
    statusMap[q.status].total += q.total

    if (['draft', 'sent', 'accepted'].includes(q.status)) pipelineTotal += q.total
    if (q.status === 'accepted' || q.status === 'won') wonTotal += q.total
    if (q.type === 'invoice') invoicedTotal += q.total
    if (q.type === 'invoice' && q.status === 'sent') outstandingTotal += q.total
  }

  const byStatus = Object.entries(statusMap)
    .map(([status, { count, total }]) => ({ status, count, total }))
    .sort((a, b) => b.total - a.total)

  // By month
  const monthMap: Record<string, number> = {}
  for (const q of quotes) {
    const m = q.createdAt.toISOString().slice(0, 7)
    monthMap[m] = (monthMap[m] ?? 0) + q.total
  }
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }))

  return NextResponse.json({
    total: quotes.length,
    pipelineTotal,
    wonTotal,
    invoicedTotal,
    outstandingTotal,
    byStatus,
    byMonth,
    quotes: quotes.map(q => ({
      id: q.id,
      number: q.number,
      type: q.type,
      status: q.status,
      total: q.total,
      issuedAt: q.issuedAt?.toISOString() ?? null,
      dueAt: q.dueAt?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
      leadName: q.lead?.name ?? null,
      leadId: q.lead?.id ?? null,
    })),
  })
}
