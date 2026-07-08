import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ token: string }> }

async function load(token: string) {
  if (!token) return null
  return prisma.appointment.findUnique({
    where: { cancelToken: token },
    include: {
      account: { select: { name: true, bookingSettings: { select: { timezone: true, cancellationHours: true, policyText: true } } } },
      bookingType: { select: { name: true } },
    },
  })
}

function view(appt: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const tz = appt.account?.bookingSettings?.timezone ?? 'Australia/Sydney'
  const cancellationHours = appt.account?.bookingSettings?.cancellationHours ?? 24
  const cutoff = appt.startTime.getTime() - cancellationHours * 3600_000
  const canCancel = appt.status === 'scheduled' && cancellationHours > 0 && Date.now() < cutoff && appt.startTime.getTime() > Date.now()
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
    canCancel,
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

  const action = (await req.json().catch(() => ({})))?.action
  if (action !== 'cancel') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  if (appt.status === 'cancelled') return NextResponse.json({ ...view(appt), alreadyCancelled: true })
  if (appt.status !== 'scheduled') return NextResponse.json({ error: 'This booking can no longer be cancelled online.' }, { status: 400 })

  const cancellationHours = appt.account?.bookingSettings?.cancellationHours ?? 24
  const cutoff = appt.startTime.getTime() - cancellationHours * 3600_000
  if (cancellationHours <= 0 || Date.now() >= cutoff) {
    return NextResponse.json({ error: 'It is too late to cancel this booking online. Please contact the business directly.' }, { status: 400 })
  }

  await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'cancelled' } })
  const updated = await load(token)
  return NextResponse.json(updated ? view(updated) : { status: 'cancelled', canCancel: false })
}
