import { prisma } from './prisma'
import { sendEmail } from './email'
import { getAccountSmtp } from './email-from'
import { getBaseUrl } from './base-url'

// System appointment emails: a reliable baseline that notifies BOTH the
// customer who booked and the business, at booking time and ~24h before the
// appointment. Editable per-account automations (trigger 'appointment_booked' /
// 'appointment_reminder') run alongside these; an account using a custom
// automation can switch the matching system email off via BookingSettings
// (notifyConfirmation / notifyReminder) to avoid duplicate messages.

function smtpReady(s: { host?: string; user?: string; pass?: string }): boolean {
  return !!(s.host && s.user && s.pass)
}

function fmtWhen(dt: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(dt)
}

/**
 * The address the business copy goes to: Account.businessEmail when set,
 * otherwise the account's earliest-created linked user (its de-facto owner),
 * else any UserAccount member. Returns null when nothing is available.
 */
export async function resolveBusinessEmail(accountId: string): Promise<string | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId }, select: { businessEmail: true },
  })
  const be = account?.businessEmail?.trim()
  if (be) return be

  const owner = await prisma.user.findFirst({
    where: { accountId }, orderBy: { createdAt: 'asc' }, select: { email: true },
  })
  if (owner?.email) return owner.email

  const member = await prisma.userAccount.findFirst({
    where: { accountId }, include: { user: { select: { email: true } } },
  })
  return member?.user?.email ?? null
}

async function loadAppointment(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      lead: { select: { name: true, email: true, phone: true, notes: true } },
      bookingType: { select: { name: true } },
      account: {
        select: {
          id: true, name: true,
          bookingSettings: {
            select: { timezone: true, cancellationHours: true, policyText: true, notifyReminder: true, notifyConfirmation: true },
          },
        },
      },
    },
  })
}

type LoadedAppointment = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>

function customerConfirmationBody(appt: LoadedAppointment, whenStr: string): string {
  const acct = appt.account!.name
  const settings = appt.account!.bookingSettings
  const serviceLine = appt.bookingType?.name ? `${appt.bookingType.name}\n` : ''
  const manage = settings && settings.cancellationHours > 0 && appt.cancelToken
    ? `\nNeed to change or cancel? Manage your booking here:\n${getBaseUrl()}/book/manage/${appt.cancelToken}\n`
    : ''
  const policy = settings?.policyText ? `\n${settings.policyText}\n` : ''
  return `Hi ${appt.lead?.name ?? ''},\n\nYour booking with ${acct} is confirmed:\n\n${serviceLine}${whenStr}\n${manage}${policy}\n— ${acct}`
}

function businessBody(appt: LoadedAppointment, whenStr: string, heading: string): string {
  const l = appt.lead
  return [
    heading,
    '',
    `Customer: ${l?.name ?? ''}`,
    l?.email ? `Email: ${l.email}` : '',
    l?.phone ? `Phone: ${l.phone}` : '',
    `Service: ${appt.bookingType?.name ?? '—'}`,
    `When: ${whenStr}`,
    l?.notes ? `\nNotes: ${l.notes}` : '',
    '',
    `— ${appt.account!.name} · Simple CRM`,
  ].filter((line) => line !== '').join('\n')
}

/**
 * Confirmation at booking time — sent to the customer and the business.
 * Best-effort: never throws (callers run it off the response path).
 */
export async function notifyAppointmentBooked(appointmentId: string): Promise<void> {
  const appt = await loadAppointment(appointmentId)
  if (!appt || !appt.accountId || !appt.account) return
  if (!appt.leadId || !appt.lead) return // only customer bookings, not internal calendar events
  const settings = appt.account.bookingSettings
  if (settings && settings.notifyConfirmation === false) return

  const smtp = await getAccountSmtp(appt.accountId)
  if (!smtpReady(smtp)) return

  const tz = settings?.timezone ?? 'Australia/Sydney'
  const whenStr = fmtWhen(appt.startTime, tz)
  const acct = appt.account.name

  if (appt.lead?.email) {
    await sendEmail(smtp, appt.lead.email, `Booking confirmed — ${acct}`,
      customerConfirmationBody(appt, whenStr)).catch(() => {})
  }

  const biz = await resolveBusinessEmail(appt.accountId)
  if (biz) {
    await sendEmail(smtp, biz, `New booking: ${appt.lead?.name ?? 'Customer'} — ${whenStr}`,
      businessBody(appt, whenStr, 'New booking received:')).catch(() => {})
  }
}

/**
 * Reschedule confirmation — customer and business — when a booking is moved via
 * the manage-booking page. Always sent (it's direct feedback for the action the
 * customer just took), best-effort.
 */
export async function notifyAppointmentRescheduled(appointmentId: string): Promise<void> {
  const appt = await loadAppointment(appointmentId)
  if (!appt || !appt.accountId || !appt.account || !appt.leadId || !appt.lead) return
  const smtp = await getAccountSmtp(appt.accountId)
  if (!smtpReady(smtp)) return

  const settings = appt.account.bookingSettings
  const tz = settings?.timezone ?? 'Australia/Sydney'
  const whenStr = fmtWhen(appt.startTime, tz)
  const acct = appt.account.name
  const serviceLine = appt.bookingType?.name ? `${appt.bookingType.name}\n` : ''
  const manage = settings && settings.cancellationHours > 0 && appt.cancelToken
    ? `\nNeed to make another change? Manage your booking here:\n${getBaseUrl()}/book/manage/${appt.cancelToken}\n`
    : ''

  if (appt.lead.email) {
    const body = `Hi ${appt.lead.name},\n\nYour booking with ${acct} has been rescheduled to:\n\n${serviceLine}${whenStr}\n${manage}\nSee you then!\n— ${acct}`
    await sendEmail(smtp, appt.lead.email, `Booking rescheduled — ${acct}`, body).catch(() => {})
  }
  const biz = await resolveBusinessEmail(appt.accountId)
  if (biz) {
    await sendEmail(smtp, biz, `Booking rescheduled: ${appt.lead.name} — ${whenStr}`,
      businessBody(appt, whenStr, 'A booking was rescheduled:')).catch(() => {})
  }
}

/**
 * System 24h-before reminder — customer and business. Runs from the daily
 * cron; a 12–36h window plus the reminderSentAt stamp mean each appointment is
 * reminded exactly once, the day before.
 */
export async function sendDueAppointmentReminders(): Promise<{ sent: number; errors: number }> {
  let sent = 0
  let errors = 0
  const now = new Date()
  const windowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000)

  const appts = await prisma.appointment.findMany({
    where: {
      startTime: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null,
      status: { notIn: ['cancelled', 'completed', 'no_show'] },
      accountId: { not: null },
      leadId: { not: null }, // only customer bookings, not internal calendar events
    },
    include: {
      lead: { select: { name: true, email: true, phone: true, notes: true } },
      bookingType: { select: { name: true } },
      account: {
        select: {
          id: true, name: true,
          bookingSettings: { select: { timezone: true, cancellationHours: true, policyText: true, notifyReminder: true, notifyConfirmation: true } },
        },
      },
    },
  })

  // Cache SMTP + business email per account across the batch.
  const smtpCache = new Map<string, Awaited<ReturnType<typeof getAccountSmtp>>>()
  const bizCache = new Map<string, string | null>()

  for (const appt of appts) {
    if (!appt.accountId || !appt.account) continue
    const settings = appt.account.bookingSettings
    if (settings && settings.notifyReminder === false) continue

    let smtp = smtpCache.get(appt.accountId)
    if (!smtp) { smtp = await getAccountSmtp(appt.accountId); smtpCache.set(appt.accountId, smtp) }
    if (!smtpReady(smtp)) continue

    const tz = settings?.timezone ?? 'Australia/Sydney'
    const whenStr = fmtWhen(appt.startTime, tz)
    const acct = appt.account.name
    const serviceLine = appt.bookingType?.name ? `${appt.bookingType.name}\n` : ''
    const manage = settings && settings.cancellationHours > 0 && appt.cancelToken
      ? `\nNeed to change or cancel? Manage your booking here:\n${getBaseUrl()}/book/manage/${appt.cancelToken}\n`
      : ''

    try {
      if (appt.lead?.email) {
        const body = `Hi ${appt.lead.name},\n\nThis is a friendly reminder of your upcoming booking with ${acct}:\n\n${serviceLine}${whenStr}\n${manage}\nSee you soon!\n— ${acct}`
        await sendEmail(smtp, appt.lead.email, `Reminder: your booking with ${acct}`, body)
      }
      let biz = bizCache.get(appt.accountId)
      if (biz === undefined) { biz = await resolveBusinessEmail(appt.accountId); bizCache.set(appt.accountId, biz) }
      if (biz) {
        await sendEmail(smtp, biz, `Reminder — upcoming appointment: ${appt.lead?.name ?? 'Customer'} (${whenStr})`,
          businessBody(appt, whenStr, 'Upcoming appointment reminder:'))
      }
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } })
      sent++
    } catch (e) {
      console.error(`Appointment reminder failed for ${appt.id}:`, e)
      errors++
    }
  }

  return { sent, errors }
}
