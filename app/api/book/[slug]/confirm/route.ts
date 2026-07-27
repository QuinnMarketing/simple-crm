import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { localToUTCDate } from '@/lib/booking-time'
import { getBaseUrl } from '@/lib/base-url'
import { notifyAppointmentBooked } from '@/lib/appointment-notifications'
import { runAppointmentBookedAutomations } from '@/lib/automations'
import { getCalendarConfig, getBusyIntervals, createCalendarEvent } from '@/lib/google-calendar'
import { getAccountStripe, getAccountStripeConfig } from '@/lib/stripe'
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
  const { date, time, name, email, phone, notes, bookingTypeId, staffId, addonIds, variantId } = body ?? {}

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
      include: {
        staff: { where: { bookable: true }, select: { userId: true } },
        addons: { where: { active: true } },
        variants: { where: { active: true } },
      },
    })
    if (!bookingType) return NextResponse.json({ error: 'That service is no longer available' }, { status: 400 })
    assignedStaff = bookingType.staff.map((s) => s.userId)
  }

  // A chosen variant sets the base duration/price; add-ons extend it
  const chosenVariant = variantId ? (bookingType?.variants ?? []).find((v) => v.id === variantId) ?? null : null
  if (bookingType && bookingType.variants.length > 0 && !chosenVariant) {
    return NextResponse.json({ error: 'Please choose an option for this service' }, { status: 400 })
  }

  // Validate chosen add-ons against the service and snapshot them
  const wantAddonIds: string[] = Array.isArray(addonIds) ? addonIds : []
  const chosenAddons = (bookingType?.addons ?? []).filter((a) => wantAddonIds.includes(a.id))
  const addonMin = chosenAddons.reduce((s, a) => s + a.durationMin, 0)
  const addonPrice = chosenAddons.reduce((s, a) => s + (a.price ?? 0), 0)

  const baseDuration = chosenVariant?.durationMin ?? bookingType?.durationMin ?? settings.slotDuration
  const durationMin = baseDuration + addonMin

  const basePrice = chosenVariant ? (chosenVariant.price ?? 0) : (bookingType?.priceType === 'free' ? 0 : bookingType?.price ?? 0)
  const totalPrice = (basePrice + addonPrice) || null
  const serviceLabel = bookingType ? `${bookingType.name}${chosenVariant ? ` — ${chosenVariant.name}` : ''}` : null
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

  // Live Google Calendar check — a booking made externally minutes ago (e.g.
  // in Fresha, synced to the account's calendar) must block this slot even
  // before the next calendar import runs. Google being unreachable falls back
  // to the CRM appointment check above rather than blocking the booking.
  const calendarConfig = await getCalendarConfig(account.id)
  if (calendarConfig) {
    try {
      const busy = await getBusyIntervals(calendarConfig, occStart.toISOString(), occEnd.toISOString())
      if (busy.some((b) => occStart.getTime() < b.end && b.start < occEnd.getTime())) {
        return NextResponse.json({ error: 'Sorry, that time was just booked. Please choose another.' }, { status: 409 })
      }
    } catch { /* best-effort — CRM clash check above still applies */ }
  }

  const lead = await prisma.lead.create({
    data: {
      name: String(name).trim().slice(0, 120),
      email: email ? String(email).slice(0, 200) : null,
      phone: phone ? String(phone).slice(0, 40) : null,
      notes: notes ? String(notes).slice(0, 1000) : null,
      service: serviceLabel,
      source: 'booking',
      status: 'new',
      accountId: account.id,
    },
  })

  // Deposit: only when the chosen service requires one AND the account has
  // Stripe connected. The deposit is a snapshot on the appointment; the webhook
  // flips depositPaid once Checkout completes. basePrice (excl. add-ons) is the
  // base for a percentage deposit, matching how services are priced.
  let depositAmount: number | null = null
  const stripeCfg = bookingType && bookingType.depositType !== 'none' ? await getAccountStripeConfig(account.id) : null
  if (bookingType && bookingType.depositType !== 'none' && stripeCfg) {
    if (bookingType.depositType === 'percent' && bookingType.depositValue != null) {
      depositAmount = Math.round(basePrice * (bookingType.depositValue / 100) * 100) / 100
    } else if (bookingType.depositType === 'fixed' && bookingType.depositValue != null) {
      depositAmount = Math.round(bookingType.depositValue * 100) / 100
    }
    if (!depositAmount || depositAmount <= 0) depositAmount = null
  }

  const cancelToken = randomBytes(24).toString('hex')
  const appointment = await prisma.appointment.create({
    data: {
      title: serviceLabel ? `${serviceLabel}: ${lead.name}` : `Booking: ${lead.name}`,
      startTime,
      endTime,
      leadId: lead.id,
      accountId: account.id,
      userId: assignedUserId,
      bookingTypeId: bookingType?.id ?? null,
      bookingPrice: totalPrice,
      addonsJson: chosenAddons.length ? JSON.stringify(chosenAddons.map((a) => ({ name: a.name, price: a.price, durationMin: a.durationMin }))) : null,
      depositAmount,
      cancelToken,
    },
  })

  // When a deposit is due, send the customer to Stripe Checkout to secure the
  // slot. The booking is already created (holding the slot); the webhook marks
  // depositPaid on completion. We skip the confirmation email here — it's sent
  // after payment, or immediately below when no deposit applies.
  if (depositAmount && stripeCfg) {
    try {
      const stripe = await getAccountStripe(account.id)
      const checkout = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'aud',
              unit_amount: Math.round(depositAmount * 100),
              product_data: { name: `Deposit — ${serviceLabel ?? 'Booking'} (${account.name})` },
            },
          },
        ],
        customer_email: lead.email ?? undefined,
        metadata: { kind: 'deposit', appointmentId: appointment.id, accountId: account.id },
        success_url: `${getBaseUrl()}/pay/result?status=success&kind=deposit`,
        cancel_url: `${getBaseUrl()}/pay/result?status=cancelled&kind=deposit`,
      })
      if (checkout.url) {
        await prisma.appointment.update({ where: { id: appointment.id }, data: { depositSessionId: checkout.id } })
        return NextResponse.json({ success: true, leadId: lead.id, checkoutUrl: checkout.url })
      }
    } catch {
      // Stripe failed — fall through to the normal (deposit-less) confirmation
      // so the booking still stands rather than losing the customer.
    }
  }

  // Push to Google right away so the busy block is visible to external
  // calendars (e.g. Fresha's sync) immediately, not at the next periodic sync.
  if (calendarConfig) {
    after(async () => {
      try {
        const googleEventId = await createCalendarEvent(calendarConfig, {
          summary: `[CRM] ${appointment.title}`,
          allDay: false,
          startIso: startTime.toISOString(),
          endIso: endTime.toISOString(),
        })
        await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId } })
      } catch { /* the next calendar sync will push it */ }
    })
  }

  // System confirmation — emails the customer AND the business (best-effort, off
  // the response path). Editable per-account automations fire alongside it; an
  // account using a custom 'appointment_booked' automation can disable the
  // system confirmation via BookingSettings.notifyConfirmation.
  after(() => notifyAppointmentBooked(appointment.id))
  after(() => runAppointmentBookedAutomations({
    id: appointment.id,
    title: appointment.title,
    startTime,
    location: appointment.location ?? null,
    accountId: account.id,
    leadId: lead.id,
  }))

  return NextResponse.json({ success: true, leadId: lead.id })
}
