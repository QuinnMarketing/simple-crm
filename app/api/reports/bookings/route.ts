import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

// Bookings report: how often each service (booking type) is booked, so a
// business can see which services are most popular. Scoped by account and by
// when the booking was made (createdAt), matching the other reports' period.

// Time-of-day buckets by local start time (in the account's booking timezone).
const TOD_ORDER = ['before_work', 'morning', 'morning_tea', 'midday', 'afternoon', 'night'] as const

function todBucket(minutesOfDay: number): (typeof TOD_ORDER)[number] {
  if (minutesOfDay < 540) return 'before_work'   // before 9:00am
  if (minutesOfDay < 630) return 'morning'        // 9:00–10:29
  if (minutesOfDay < 720) return 'morning_tea'    // 10:30–11:59
  if (minutesOfDay < 840) return 'midday'         // 12:00–1:59pm
  if (minutesOfDay < 1020) return 'afternoon'     // 2:00–4:59pm
  return 'night'                                  // 5:00pm onwards
}

// Local minutes-since-midnight of a UTC instant, in the given timezone.
const _todFmt = new Map<string, Intl.DateTimeFormat>()
function localMinutesOfDay(date: Date, tz: string): number {
  let f = _todFmt.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
    _todFmt.set(tz, f)
  }
  const parts = f.formatToParts(date)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24 // some runtimes emit '24' at midnight
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

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
      account: { select: { bookingSettings: { select: { timezone: true } } } },
    },
    orderBy: { startTime: 'desc' },
  })

  const serviceMap = new Map<string, { count: number; revenue: number; cancelled: number }>()
  const statusMap: Record<string, number> = {}
  const todMap: Record<string, number> = {}
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
      // Bucket confirmed bookings by local start time of day.
      const tz = a.account?.bookingSettings?.timezone ?? 'Australia/Sydney'
      const bucket = todBucket(localMinutesOfDay(a.startTime, tz))
      todMap[bucket] = (todMap[bucket] ?? 0) + 1
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
    byTimeOfDay: TOD_ORDER.map((bucket) => ({ bucket, count: todMap[bucket] ?? 0 })),
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
