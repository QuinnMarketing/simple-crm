import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

// Bookings report: how often each service (booking type) is booked, so a
// business can see which services are most popular. Scoped by account and by
// when the booking was made (createdAt), matching the other reports' period.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountParam = searchParams.get('account') ?? undefined
  const accountFilter = getAccountFilter(session.user, accountParam)

  const appts = await prisma.appointment.findMany({
    where: {
      ...accountFilter,
      bookingTypeId: { not: null }, // only real service bookings, not internal calendar events
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    select: {
      id: true, status: true, bookingPrice: true, startTime: true,
      bookingType: { select: { name: true } },
      lead: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'desc' },
  })

  const serviceMap = new Map<string, { count: number; revenue: number; cancelled: number }>()
  const statusMap: Record<string, number> = {}
  let cancelled = 0
  let bookedValue = 0

  for (const a of appts) {
    const svc = a.bookingType?.name ?? 'Unspecified'
    statusMap[a.status] = (statusMap[a.status] ?? 0) + 1
    const entry = serviceMap.get(svc) ?? { count: 0, revenue: 0, cancelled: 0 }
    if (a.status === 'cancelled') {
      cancelled++
      entry.cancelled++
    } else {
      entry.count++
      if (a.bookingPrice) { entry.revenue += a.bookingPrice; bookedValue += a.bookingPrice }
    }
    serviceMap.set(svc, entry)
  }

  const byService = [...serviceMap.entries()]
    .map(([service, v]) => ({ service, count: v.count, revenue: v.revenue, cancelled: v.cancelled }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)

  const byStatus = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  const totalBookings = byService.reduce((s, x) => s + x.count, 0)
  const topService = byService.find((s) => s.count > 0)?.service ?? null

  return NextResponse.json({
    totalBookings,
    services: byService.filter((s) => s.count > 0).length,
    topService,
    cancelled,
    bookedValue,
    byService,
    byStatus,
    bookings: appts.slice(0, 500).map((a) => ({
      id: a.id,
      service: a.bookingType?.name ?? 'Unspecified',
      status: a.status,
      price: a.bookingPrice,
      when: a.startTime.toISOString(),
      leadName: a.lead?.name ?? null,
      leadId: a.lead?.id ?? null,
    })),
  })
}
