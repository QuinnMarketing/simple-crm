import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { localToUTCms as localToUTC } from '@/lib/booking-time'

type DayConfig = { enabled: boolean; start: string; end: string }
type AvailableHours = Record<string, DayConfig>
type Interval = { start: number; end: number }
type SlotShape = { durationMin: number; bufferBefore: number; bufferAfter: number }

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function todayInTZ(tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(Date.now())
}
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
function parseHours(raw: string): AvailableHours {
  try { return JSON.parse(raw) } catch { return {} }
}
// A staff member's own hours, or the business hours when they haven't set any
function resolveHours(raw: string, business: AvailableHours): AvailableHours {
  const h = parseHours(raw)
  return Object.keys(h).length > 0 ? h : business
}

// A "resource" is a bookable calendar (a staff member, or the shared business
// calendar when no staff are assigned): its working hours and its busy times.
type Resource = { hours: AvailableHours; busy: Interval[] }

// A date is offered if at least one resource works that weekday with room for
// the service. Lightweight — no per-slot busy check (that happens at slot level).
function getAvailableDates(
  settings: { maxDaysAhead: number; minNoticeHours: number; timezone: string },
  resourceHours: AvailableHours[],
  shape: SlotShape,
  year: number,
  month: number
): string[] {
  const tz = settings.timezone
  const cutoffMs = Date.now() + settings.minNoticeHours * 3600_000
  const todayStr = todayInTZ(tz)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const available: string[] = []

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (dateStr < todayStr) continue
    const diffDays = (new Date(dateStr + 'T00:00:00Z').getTime() - new Date(todayStr + 'T00:00:00Z').getTime()) / 86_400_000
    if (diffDays > settings.maxDaysAhead) continue

    const dayKey = DAY_KEYS[getDayOfWeek(dateStr)]
    const fits = resourceHours.some((hours) => {
      const dc = hours[dayKey]
      if (!dc?.enabled) return false
      const firstUTC = localToUTC(dateStr, dc.start, tz)
      const endUTC = localToUTC(dateStr, dc.end, tz)
      return endUTC - firstUTC >= shape.durationMin * 60_000 && endUTC > cutoffMs
    })
    if (fits) available.push(dateStr)
  }
  return available
}

// Union of each resource's free slot grid — a time is offered if any resource
// works then and is free. This is what makes "any available staff" work.
function getSlotsForDate(
  settings: { minNoticeHours: number; timezone: string },
  resources: Resource[],
  shape: SlotShape,
  dateStr: string
): string[] {
  const dayKey = DAY_KEYS[getDayOfWeek(dateStr)]
  const cutoffMs = Date.now() + settings.minNoticeHours * 3600_000
  const step = shape.durationMin + shape.bufferBefore + shape.bufferAfter
  const offered = new Set<string>()

  for (const res of resources) {
    const dc = res.hours[dayKey]
    if (!dc?.enabled) continue
    const [sh, sm] = dc.start.split(':').map(Number)
    const [eh, em] = dc.end.split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em

    for (let min = startMin; min + shape.durationMin <= endMin; min += step) {
      const timeStr = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
      if (offered.has(timeStr)) continue
      const slotUTC = localToUTC(dateStr, timeStr, settings.timezone)
      if (slotUTC < cutoffMs) continue
      const occStart = slotUTC - shape.bufferBefore * 60_000
      const occEnd = slotUTC + (shape.durationMin + shape.bufferAfter) * 60_000
      if (res.busy.some((b) => occStart < b.end && b.start < occEnd)) continue
      offered.add(timeStr)
    }
  }
  return [...offered].sort()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = req.nextUrl
  const monthParam = searchParams.get('month')
  const dateParam = searchParams.get('date')
  const typeParam = searchParams.get('type')
  const staffParam = searchParams.get('staff') // userId or 'any'/absent

  const account = await prisma.account.findUnique({
    where: { slug },
    include: {
      bookingSettings: true,
      bookingTypes: {
        where: { active: true, onlineBookable: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          staff: {
            where: { bookable: true },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  if (!account || !account.bookingSettings?.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const settings = account.bookingSettings
  const businessHours = parseHours(settings.availableHours)
  const types = account.bookingTypes

  const chosenType = typeParam ? types.find((t) => t.id === typeParam) ?? null : null
  const shape: SlotShape = chosenType
    ? { durationMin: chosenType.durationMin, bufferBefore: chosenType.bufferBefore, bufferAfter: chosenType.bufferAfter }
    : { durationMin: settings.slotDuration, bufferBefore: 0, bufferAfter: settings.bufferTime }

  // Staff assigned to the chosen service (bookable). Empty → shared calendar mode.
  const typeStaff = chosenType?.staff ?? []
  const staffMode = typeStaff.length > 0
  // Which staff to consider: a specific one if requested & valid, else all
  const candidates = staffMode
    ? (staffParam && staffParam !== 'any' ? typeStaff.filter((p) => p.userId === staffParam) : typeStaff)
    : []

  const bookingInfo = {
    title: settings.title,
    description: settings.description,
    slotDuration: shape.durationMin,
    timezone: settings.timezone,
    policyText: settings.policyText,
    types: types.map((t) => ({
      id: t.id, name: t.name, category: t.category, description: t.description,
      durationMin: t.durationMin, price: t.price, priceType: t.priceType,
      hasStaff: t.staff.length > 0,
    })),
    staff: staffMode ? typeStaff.map((p) => ({ id: p.userId, name: p.user.name })) : [],
  }

  const resourceHours: AvailableHours[] = staffMode
    ? candidates.map((p) => resolveHours(p.availableHours, businessHours))
    : [businessHours]

  if (dateParam) {
    const dayStart = localToUTC(dateParam, '00:00', settings.timezone)
    const appts = await prisma.appointment.findMany({
      where: {
        accountId: account.id,
        status: { not: 'cancelled' },
        startTime: { lt: new Date(dayStart + 28 * 3600_000) },
        endTime: { gt: new Date(dayStart - 4 * 3600_000) },
      },
      select: { startTime: true, endTime: true, userId: true },
    })
    const toInterval = (a: { startTime: Date; endTime: Date }): Interval => ({ start: a.startTime.getTime(), end: a.endTime.getTime() })

    const resources: Resource[] = staffMode
      ? candidates.map((p) => ({
          hours: resolveHours(p.availableHours, businessHours),
          // A staff member is only blocked by appointments assigned to them
          busy: appts.filter((a) => a.userId === p.userId).map(toInterval),
        }))
      : [{ hours: businessHours, busy: appts.map(toInterval) }]

    const slots = getSlotsForDate(settings, resources, shape, dateParam)
    return NextResponse.json({ slots, info: bookingInfo })
  }

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number)
    const dates = getAvailableDates(settings, resourceHours, shape, y, m - 1)
    return NextResponse.json({ dates, info: bookingInfo })
  }

  return NextResponse.json({ info: bookingInfo })
}
