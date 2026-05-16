import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

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
