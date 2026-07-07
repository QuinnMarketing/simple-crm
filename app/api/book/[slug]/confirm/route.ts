import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Public endpoint that creates a lead + appointment — throttle to stop spam
  const ip = getClientIp(req)
  if (!rateLimit(`book:ip:${ip}`, 10, 10 * 60_000) || !rateLimit(`book:slug:${slug}`, 40, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const account = await prisma.account.findUnique({
    where: { slug },
    include: { bookingSettings: true },
  })

  if (!account || !account.bookingSettings?.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { date, time, name, email, phone, notes } = body ?? {}

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return NextResponse.json({ error: 'Invalid time' }, { status: 400 })
  if (!name || typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const settings = account.bookingSettings

  const [h, m] = time.split(':').map(Number)
  const startLocal = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  const endLocal = new Date(startLocal.getTime() + settings.slotDuration * 60 * 1000)

  if (isNaN(startLocal.getTime())) return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 })
  // Reject bookings in the past — stops junk appointments backfilling the calendar
  if (startLocal.getTime() < Date.now()) return NextResponse.json({ error: 'That time has already passed' }, { status: 400 })

  const lead = await prisma.lead.create({
    data: {
      name: String(name).trim().slice(0, 120),
      email: email ? String(email).slice(0, 200) : null,
      phone: phone ? String(phone).slice(0, 40) : null,
      notes: notes ? String(notes).slice(0, 1000) : null,
      source: 'booking',
      status: 'new',
      accountId: account.id,
    },
  })

  await prisma.appointment.create({
    data: {
      title: `Booking: ${lead.name}`,
      startTime: startLocal,
      endTime: endLocal,
      leadId: lead.id,
      accountId: account.id,
    },
  })

  return NextResponse.json({ success: true, leadId: lead.id })
}
