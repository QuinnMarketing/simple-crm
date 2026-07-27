import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { localToUTCDate } from '@/lib/booking-time'
import { getCalendarConfig, updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'
import { notifyAppointmentRescheduled } from '@/lib/appointment-notifications'
import { after } from 'next/server'

type Params = { params: Promise<{ token: string }> }

async function load(token: string) {
  if (!token) return null
  return prisma.appointment.findFirst({
    where: { cancelToken: token },
    include: {
      account: {
        select: {
          id: true, name: true, slug: true,
          bookingSettings: {
            select: { timezone: true, cancellationHours: true, policyText: true, minNoticeHours: true, maxDaysAhead: true, bufferTime: true },
          },
        },
      },
      bookingType: { select: { name: true, bufferBefore: true, bufferAfter: true } },
    },
  })
}

type LoadedAppt = NonNullable<Awaited<ReturnType<typeof load>>>

function withinWindow(appt: LoadedAppt): boolean {
  const cancellationHours = appt.account?.bookingSettings?.cancellationHours ?? 24
  const cutoff = appt.startTime.getTime() - cancellationHours * 3600_000
  return appt.status === 'scheduled' && cancellationHours > 0 && Date.now() < cutoff && appt.startTime.getTime() > Date.now()
}

function view(appt: LoadedAppt) {
  const tz = appt.account?.bookingSettings?.timezone ?? 'Australia/Sydney'
  const cancellationHours = appt.account?.bookingSettings?.cancellationHours ?? 24
  const canManage = withinWindow(appt)
  return {
    business: appt.account?.name ?? '',
    service: appt.bookingType?.name ?? null,
    when: new Intl.DateTimeFormat('en-AU', {
      timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(appt.startTime),
    status: appt.status,
    cancellationHours,
    policyText: appt.account?.bookingSettings?.policyText ?? null,
    canCancel: canManage,
    canReschedule: canManage,
    // Lets the manage page fetch open slots from the public availability endpoint.
    accountSlug: appt.account?.slug ?? null,
    bookingTypeId: appt.bookingTypeId,
    staffId: appt.userId,
    timezone: tz,
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const appt = await load(token)
  if (!appt) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json(view(appt))
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const appt = await load(token)
  if (!appt) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === 'cancel') return cancel(token, appt)
  if (action === 'reschedule') return reschedule(token, appt, body)
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function cancel(token: string, appt: LoadedAppt) {
  if (appt.status === 'cancelled') return NextResponse.json({ ...view(appt), alreadyCancelled: true })
  if (appt.status !== 'scheduled') return NextResponse.json({ error: 'This booking can no longer be cancelled online.' }, { status: 400 })

  const cancellationHours = appt.account?.bookingSettings?.cancellationHours ?? 24
  const cutoff = appt.startTime.getTime() - cancellationHours * 3600_000
  if (cancellationHours <= 0 || Date.now() >= cutoff) {
    return NextResponse.json({ error: 'It is too late to cancel this booking online. Please contact the business directly.' }, { status: 400 })
  }

  await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'cancelled' } })

  // Free the slot on the connected calendar too, so the block disappears
  // externally (e.g. in Fresha's synced view), not just in the CRM.
  if (appt.googleEventId && appt.accountId) {
    after(async () => {
      try {
        const cfg = await getCalendarConfig(appt.accountId!)
        if (cfg) await deleteCalendarEvent(cfg, appt.googleEventId!)
      } catch { /* the next calendar sync reconciles it */ }
    })
  }

  const updated = await load(token)
  return NextResponse.json(updated ? view(updated) : { status: 'cancelled', canCancel: false })
}

async function reschedule(token: string, appt: LoadedAppt, body: { date?: unknown; time?: unknown }) {
  if (appt.status !== 'scheduled') return NextResponse.json({ error: 'This booking can no longer be changed online.' }, { status: 400 })
  if (!withinWindow(appt)) {
    return NextResponse.json({ error: 'It is too late to reschedule this booking online. Please contact the business directly.' }, { status: 400 })
  }

  const settings = appt.account?.bookingSettings
  const tz = settings?.timezone ?? 'Australia/Sydney'
  const date = String(body?.date ?? '')
  const time = String(body?.time ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: 'Please choose a new date and time.' }, { status: 400 })
  }

  const newStart = localToUTCDate(date, time, tz)
  if (isNaN(newStart.getTime())) return NextResponse.json({ error: 'Invalid date or time.' }, { status: 400 })
  const durationMs = appt.endTime.getTime() - appt.startTime.getTime()
  const newEnd = new Date(newStart.getTime() + durationMs)

  const minNotice = settings?.minNoticeHours ?? 0
  if (newStart.getTime() < Date.now() + minNotice * 3600_000) {
    return NextResponse.json({ error: 'Please choose a time a little further ahead.' }, { status: 400 })
  }
  const maxDaysAhead = settings?.maxDaysAhead ?? 60
  if (newStart.getTime() > Date.now() + maxDaysAhead * 86_400_000) {
    return NextResponse.json({ error: 'That date is too far ahead.' }, { status: 400 })
  }

  // Clash check against other appointments (excluding this one). When a staff
  // member is assigned, only their own bookings block; otherwise the shared
  // business calendar allows one booking per slot.
  const bufBefore = appt.bookingType?.bufferBefore ?? 0
  const bufAfter = appt.bookingType?.bufferAfter ?? settings?.bufferTime ?? 0
  const occStart = new Date(newStart.getTime() - bufBefore * 60_000)
  const occEnd = new Date(newEnd.getTime() + bufAfter * 60_000)
  const clash = await prisma.appointment.findFirst({
    where: {
      accountId: appt.accountId ?? undefined,
      id: { not: appt.id },
      status: { not: 'cancelled' },
      ...(appt.userId ? { userId: appt.userId } : {}),
      startTime: { lt: occEnd },
      endTime: { gt: occStart },
    },
    select: { id: true },
  })
  if (clash) return NextResponse.json({ error: 'Sorry, that time is no longer available. Please choose another.' }, { status: 409 })

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { startTime: newStart, endTime: newEnd, reminderSentAt: null },
  })

  // Move the calendar block and re-send confirmations for the new time.
  if (appt.googleEventId && appt.accountId) {
    after(async () => {
      try {
        const cfg = await getCalendarConfig(appt.accountId!)
        if (cfg) await updateCalendarEvent(cfg, appt.googleEventId!, {
          summary: `[CRM] ${appt.title}`, allDay: false,
          startIso: newStart.toISOString(), endIso: newEnd.toISOString(),
        })
      } catch { /* the next calendar sync reconciles it */ }
    })
  }
  after(() => notifyAppointmentRescheduled(appt.id))

  const updated = await load(token)
  return NextResponse.json(updated ? { ...view(updated), rescheduled: true } : { status: 'scheduled' })
}
