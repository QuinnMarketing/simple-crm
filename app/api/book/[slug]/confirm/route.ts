import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { localToUTCDate } from '@/lib/booking-time'
import { getAccountSmtp } from '@/lib/email-from'
import { sendEmail } from '@/lib/email'
import { getBaseUrl } from '@/lib/base-url'
import { randomBytes } from 'crypto'
import { after } from 'next/server'

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
  const { date, time, name, email, phone, notes, bookingTypeId, staffId } = body ?? {}

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return NextResponse.json({ error: 'Invalid time' }, { status: 400 })
  if (!name || typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const settings = account.bookingSettings

  // Resolve the chosen service (if any) — must belong to this account and be bookable
  let bookingType = null
  let assignedStaff: string[] = []
  if (bookingTypeId) {
    bookingType = await prisma.bookingType.findFirst({
      where: { id: bookingTypeId, accountId: account.id, active: true, onlineBookable: true },
      include: { staff: { where: { bookable: true }, select: { userId: true } } },
    })
    if (!bookingType) return NextResponse.json({ error: 'That service is no longer available' }, { status: 400 })
    assignedStaff = bookingType.staff.map((s) => s.userId)
  }

  const durationMin = bookingType?.durationMin ?? settings.slotDuration
  const bufferBefore = bookingType?.bufferBefore ?? 0
  const bufferAfter = bookingType?.bufferAfter ?? settings.bufferTime

  // Convert in the account's timezone so stored times line up with the shown slots
  const startTime = localToUTCDate(date, time, settings.timezone)
  const endTime = new Date(startTime.getTime() + durationMin * 60_000)

  if (isNaN(startTime.getTime())) return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 })
  if (startTime.getTime() < Date.now()) return NextResponse.json({ error: 'That time has already passed' }, { status: 400 })

  const occStart = new Date(startTime.getTime() - bufferBefore * 60_000)
  const occEnd = new Date(endTime.getTime() + bufferAfter * 60_000)

  // Allocate a staff member when the service has a team; otherwise use the
  // shared calendar (one booking per slot for the whole business).
  let assignedUserId: string | null = null
  if (assignedStaff.length > 0) {
    const wanted = staffId && staffId !== 'any' ? assignedStaff.filter((u) => u === staffId) : assignedStaff
    if (wanted.length === 0) return NextResponse.json({ error: 'That team member is not available for this service' }, { status: 400 })
    for (const uid of wanted) {
      const clash = await prisma.appointment.findFirst({
        where: { accountId: account.id, userId: uid, status: { not: 'cancelled' }, startTime: { lt: occEnd }, endTime: { gt: occStart } },
        select: { id: true },
      })
      if (!clash) { assignedUserId = uid; break }
    }
    if (!assignedUserId) return NextResponse.json({ error: 'Sorry, that time was just booked. Please choose another.' }, { status: 409 })
  } else {
    const clash = await prisma.appointment.findFirst({
      where: { accountId: account.id, status: { not: 'cancelled' }, startTime: { lt: occEnd }, endTime: { gt: occStart } },
      select: { id: true },
    })
    if (clash) return NextResponse.json({ error: 'Sorry, that time was just booked. Please choose another.' }, { status: 409 })
  }

  const lead = await prisma.lead.create({
    data: {
      name: String(name).trim().slice(0, 120),
      email: email ? String(email).slice(0, 200) : null,
      phone: phone ? String(phone).slice(0, 40) : null,
      notes: notes ? String(notes).slice(0, 1000) : null,
      service: bookingType?.name ?? null,
      source: 'booking',
      status: 'new',
      accountId: account.id,
    },
  })

  const cancelToken = randomBytes(24).toString('hex')
  await prisma.appointment.create({
    data: {
      title: bookingType ? `${bookingType.name}: ${lead.name}` : `Booking: ${lead.name}`,
      startTime,
      endTime,
      leadId: lead.id,
      accountId: account.id,
      userId: assignedUserId,
      bookingTypeId: bookingType?.id ?? null,
      bookingPrice: bookingType?.priceType === 'free' ? 0 : bookingType?.price ?? null,
      cancelToken,
    },
  })

  // Confirmation email with a self-service manage link (best-effort, off the response path)
  if (lead.email) {
    after(async () => {
      const smtp = await getAccountSmtp(account.id)
      if (!smtp.host || !smtp.user || !smtp.pass) return
      const whenStr = new Intl.DateTimeFormat('en-AU', {
        timeZone: settings.timezone, weekday: 'long', day: 'numeric', month: 'long',
        hour: 'numeric', minute: '2-digit', hour12: true,
      }).format(startTime)
      const manageUrl = `${getBaseUrl()}/book/manage/${cancelToken}`
      const lines = [
        `Hi ${lead.name},`,
        '',
        `Your booking with ${account.name} is confirmed:`,
        '',
        `${bookingType ? bookingType.name + '\n' : ''}${whenStr}`,
        '',
        settings.cancellationHours > 0
          ? `Need to change or cancel? Manage your booking here:\n${manageUrl}`
          : '',
        settings.policyText ? `\n${settings.policyText}` : '',
        '',
        `— ${account.name}`,
      ].filter((l) => l !== null).join('\n')
      await sendEmail(smtp, lead.email!, `Booking confirmed — ${account.name}`, lines).catch(() => {})
    })
  }

  return NextResponse.json({ success: true, leadId: lead.id })
}
