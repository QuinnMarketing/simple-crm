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

  const entries = await prisma.timeEntry.findMany({
    where: {
      ...accountFilter,
      startedAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    include: {
      lead: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  const totalMin = entries.reduce((s, e) => s + e.durationMin, 0)

  // By employee
  const empMap: Record<string, { name: string; totalMin: number; byType: Record<string, number> }> = {}
  for (const e of entries) {
    const name = e.assignedTo ?? e.user?.name ?? e.user?.email ?? 'Unknown'
    if (!empMap[name]) empMap[name] = { name, totalMin: 0, byType: {} }
    empMap[name].totalMin += e.durationMin
    empMap[name].byType[e.type] = (empMap[name].byType[e.type] ?? 0) + e.durationMin
  }

  // By type
  const typeMap: Record<string, number> = {}
  for (const e of entries) {
    typeMap[e.type] = (typeMap[e.type] ?? 0) + e.durationMin
  }

  // By day (for sparkline)
  const dayMap: Record<string, number> = {}
  for (const e of entries) {
    const day = e.startedAt.toISOString().split('T')[0]
    dayMap[day] = (dayMap[day] ?? 0) + e.durationMin
  }
  const byDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({ date, minutes }))

  const byEmployee = Object.values(empMap).sort((a, b) => b.totalMin - a.totalMin)
  const byType = Object.entries(typeMap)
    .map(([type, minutes]) => ({ type, minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  return NextResponse.json({
    totalMin,
    totalEntries: entries.length,
    uniqueEmployees: byEmployee.length,
    byEmployee,
    byType,
    byDay,
    entries: entries.map(e => ({
      id: e.id,
      type: e.type,
      description: e.description,
      durationMin: e.durationMin,
      startedAt: e.startedAt.toISOString(),
      assignedTo: e.assignedTo ?? e.user?.name ?? e.user?.email ?? null,
      leadName: e.lead?.name ?? null,
      leadId: e.lead?.id ?? null,
    })),
  })
}
