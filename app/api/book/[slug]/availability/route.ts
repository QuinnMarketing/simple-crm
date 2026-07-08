import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { localToUTCms as localToUTC } from '@/lib/booking-time'

type DayConfig = { enabled: boolean; start: string; end: string }
type AvailableHours = Record<string, DayConfig>

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

// The service parameters that drive slot length — either from a chosen
// BookingType or, as a fallback for accounts without types, the global settings.
type SlotShape = { durationMin: number; bufferBefore: number; bufferAfter: number }

function getAvailableDates(
  settings: { availableHours: string; maxDaysAhead: number; minNoticeHours: number; timezone: string },
  shape: SlotShape,
  year: number,
  month: number // 0-indexed
): string[] {
  const hours = parseHours(settings.availableHours)
  const tz = settings.timezone
  const cutoffMs = Date.now() + settings.minNoticeHours * 3600_000
  const todayStr = todayInTZ(tz)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const available: string[] = []

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (dateStr < todayStr) continue

    const todayDate = new Date(todayStr + 'T00:00:00Z')
    const thisDate = new Date(dateStr + 'T00:00:00Z')
    const diffDays = (thisDate.getTime() - todayDate.getTime()) / 86_400_000
    if (diffDays > settings.maxDaysAhead) continue

    const dayKey = DAY_KEYS[getDayOfWeek(dateStr)]
    const dayConfig: DayConfig | undefined = hours[dayKey]
    if (!dayConfig?.enabled) continue

    // At least one appointment of this length must fit before close and after cutoff
    const [startH, startM] = dayConfig.start.split(':').map(Number)
    const firstSlotUTC = localToUTC(dateStr, `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`, tz)
    const dayEndUTC = localToUTC(dateStr, dayConfig.end, tz)
    if (dayEndUTC - firstSlotUTC < shape.durationMin * 60_000) continue
    if (dayEndUTC <= cutoffMs) continue

    available.push(dateStr)
  }

  return available
}

function getSlotsForDate(
  settings: { availableHours: string; minNoticeHours: number; timezone: string },
  shape: SlotShape,
  dateStr: string,
  busy: Array<{ start: number; end: number }>
): string[] {
  const hours = parseHours(settings.availableHours)
  const dayKey = DAY_KEYS[getDayOfWeek(dateStr)]
  const dayConfig: DayConfig | undefined = hours[dayKey]
  if (!dayConfig?.enabled) return []

  const [startH, startM] = dayConfig.start.split(':').map(Number)
  const [endH, endM] = dayConfig.end.split(':').map(Number)
  const startMin = startH * 60 + startM
  const endMin = endH * 60 + endM
  // Space slots by the full footprint so consecutive bookings never collide
  const step = shape.durationMin + shape.bufferBefore + shape.bufferAfter
  const cutoffMs = Date.now() + settings.minNoticeHours * 3600_000
  const slots: string[] = []

  for (let min = startMin; min + shape.durationMin <= endMin; min += step) {
    const h = Math.floor(min / 60)
    const m = min % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const slotUTC = localToUTC(dateStr, timeStr, settings.timezone)
    if (slotUTC < cutoffMs) continue

    // Skip slots whose occupied window overlaps an existing appointment
    const occStart = slotUTC - shape.bufferBefore * 60_000
    const occEnd = slotUTC + (shape.durationMin + shape.bufferAfter) * 60_000
    const clash = busy.some((b) => occStart < b.end && b.start < occEnd)
    if (clash) continue

    slots.push(timeStr)
  }

  return slots
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = req.nextUrl
  const monthParam = searchParams.get('month') // YYYY-MM
  const dateParam = searchParams.get('date')   // YYYY-MM-DD
  const typeParam = searchParams.get('type')   // BookingType id

  const account = await prisma.account.findUnique({
    where: { slug },
    include: {
      bookingSettings: true,
      bookingTypes: {
        where: { active: true, onlineBookable: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
    },
  })

  if (!account || !account.bookingSettings?.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const settings = account.bookingSettings
  const types = account.bookingTypes

  // Resolve the slot shape from the chosen type, or fall back to global settings
  const chosenType = typeParam ? types.find((t) => t.id === typeParam) ?? null : null
  const shape: SlotShape = chosenType
    ? { durationMin: chosenType.durationMin, bufferBefore: chosenType.bufferBefore, bufferAfter: chosenType.bufferAfter }
    : { durationMin: settings.slotDuration, bufferBefore: 0, bufferAfter: settings.bufferTime }

  const bookingInfo = {
    title: settings.title,
    description: settings.description,
    slotDuration: shape.durationMin,
    timezone: settings.timezone,
    types: types.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      durationMin: t.durationMin,
      price: t.price,
      priceType: t.priceType,
    })),
  }

  if (dateParam) {
    // Pull existing appointments overlapping this day for double-booking exclusion
    const dayStart = localToUTC(dateParam, '00:00', settings.timezone)
    const dayEnd = dayStart + 24 * 3600_000
    const appts = await prisma.appointment.findMany({
      where: {
        accountId: account.id,
        startTime: { lt: new Date(dayEnd + 4 * 3600_000) },
        endTime: { gt: new Date(dayStart - 4 * 3600_000) },
      },
      select: { startTime: true, endTime: true },
    })
    const busy = appts.map((a) => ({ start: a.startTime.getTime(), end: a.endTime.getTime() }))
    const slots = getSlotsForDate(settings, shape, dateParam, busy)
    return NextResponse.json({ slots, info: bookingInfo })
  }

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number)
    const dates = getAvailableDates(settings, shape, y, m - 1)
    return NextResponse.json({ dates, info: bookingInfo })
  }

  return NextResponse.json({ info: bookingInfo })
}
