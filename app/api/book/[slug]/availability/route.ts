import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type DayConfig = { enabled: boolean; start: string; end: string }
type AvailableHours = Record<string, DayConfig>

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Convert a local YYYY-MM-DD + HH:MM in a named timezone to a UTC ms timestamp.
function localToUTC(dateStr: string, timeStr: string, tz: string): number {
  const dtStr = `${dateStr}T${timeStr}:00`
  // Treat as if UTC to get a reference point
  const asUTCMs = new Date(dtStr + 'Z').getTime()
  // Format that UTC moment in the target timezone
  const inTZ = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(asUTCMs)
  // inTZ looks like "2026-05-20 19:30:00" — parse it as UTC
  const tzAsUTCMs = new Date(inTZ.replace(' ', 'T') + 'Z').getTime()
  // offset = how far ahead the tz is from UTC at that moment
  const offset = tzAsUTCMs - asUTCMs
  // True UTC for the local time = asUTCMs - offset
  return asUTCMs - offset
}

// Get today's date string (YYYY-MM-DD) in the given timezone.
function todayInTZ(tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(Date.now())
}

// Get the day-of-week index (0=Sun) for a YYYY-MM-DD string.
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function parseHours(raw: string): AvailableHours {
  try { return JSON.parse(raw) } catch { return {} }
}

function getAvailableDates(
  settings: { availableHours: string; maxDaysAhead: number; minNoticeHours: number; timezone: string },
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

    // Max days ahead check
    const todayDate = new Date(todayStr + 'T00:00:00Z')
    const thisDate = new Date(dateStr + 'T00:00:00Z')
    const diffDays = (thisDate.getTime() - todayDate.getTime()) / 86_400_000
    if (diffDays > settings.maxDaysAhead) continue

    const dayKey = DAY_KEYS[getDayOfWeek(dateStr)]
    const dayConfig: DayConfig | undefined = hours[dayKey]
    if (!dayConfig?.enabled) continue

    // Check if at least one slot fits before end-of-day AND after cutoff
    const dayEndUTC = localToUTC(dateStr, dayConfig.end, tz)
    if (dayEndUTC <= cutoffMs) continue

    available.push(dateStr)
  }

  return available
}

function getSlotsForDate(
  settings: { availableHours: string; slotDuration: number; bufferTime: number; minNoticeHours: number; timezone: string },
  dateStr: string
): string[] {
  const hours = parseHours(settings.availableHours)
  const dayKey = DAY_KEYS[getDayOfWeek(dateStr)]
  const dayConfig: DayConfig | undefined = hours[dayKey]

  if (!dayConfig?.enabled) return []

  const [startH, startM] = dayConfig.start.split(':').map(Number)
  const [endH, endM] = dayConfig.end.split(':').map(Number)
  const startMin = startH * 60 + startM
  const endMin = endH * 60 + endM
  const step = settings.slotDuration + settings.bufferTime

  const cutoffMs = Date.now() + settings.minNoticeHours * 3600_000
  const slots: string[] = []

  for (let min = startMin; min + settings.slotDuration <= endMin; min += step) {
    const h = Math.floor(min / 60)
    const m = min % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const slotUTC = localToUTC(dateStr, timeStr, settings.timezone)
    if (slotUTC < cutoffMs) continue
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

  const account = await prisma.account.findUnique({
    where: { slug },
    include: { bookingSettings: true },
  })

  if (!account || !account.bookingSettings?.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const settings = account.bookingSettings

  const bookingInfo = {
    title: settings.title,
    description: settings.description,
    slotDuration: settings.slotDuration,
    timezone: settings.timezone,
  }

  if (dateParam) {
    const slots = getSlotsForDate(settings, dateParam)
    return NextResponse.json({ slots, info: bookingInfo })
  }

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number)
    const dates = getAvailableDates(settings, y, m - 1)
    return NextResponse.json({ dates, info: bookingInfo })
  }

  // No params — just return info
  return NextResponse.json({ info: bookingInfo })
}
