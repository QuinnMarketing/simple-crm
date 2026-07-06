import { prisma } from './prisma'
import {
  getCalendarConfig,
  listCalendarEvents,
  createCalendarEvent,
} from './google-calendar'

const SYNC_WINDOW_PAST_DAYS = 30
const SYNC_WINDOW_FUTURE_DAYS = 120
const GCAL_MAX_RESULTS = 250 // must match listCalendarEvents maxResults

// CRM-pushed events carry a "[CRM] " prefix in Google — strip it when
// bringing titles back so they don't accumulate or overwrite CRM titles
function stripCrmPrefix(summary: string): string {
  return summary.replace(/^\[CRM\]\s*/, '')
}

export type SyncResult = {
  imported: number
  updated: number
  deleted: number
  pushed: number
}

/**
 * Two-way sync between the account's Google Calendar and CRM appointments,
 * keyed on googleEventId. Google → CRM: new events are imported, edits are
 * applied when Google's copy is newer, and events deleted in Google remove
 * their CRM counterpart. CRM → Google: appointments that never got pushed
 * (created before connecting, or by automations) are pushed and linked.
 */
export async function syncGoogleCalendar(accountId: string): Promise<SyncResult | null> {
  const config = await getCalendarConfig(accountId)
  if (!config) return null

  const now = Date.now()
  const from = new Date(now - SYNC_WINDOW_PAST_DAYS * 86_400_000)
  const to = new Date(now + SYNC_WINDOW_FUTURE_DAYS * 86_400_000)

  const [gcalEvents, appointments] = await Promise.all([
    listCalendarEvents(config, from.toISOString(), to.toISOString()),
    prisma.appointment.findMany({
      where: { accountId, startTime: { gte: from, lte: to } },
    }),
  ])

  const result: SyncResult = { imported: 0, updated: 0, deleted: 0, pushed: 0 }
  const byGoogleId = new Map(appointments.filter(a => a.googleEventId).map(a => [a.googleEventId!, a]))
  const gcalIds = new Set(gcalEvents.map(e => e.id))

  // ── Google → CRM: import new, update changed ──────────────────────────────
  for (const event of gcalEvents) {
    const existing = byGoogleId.get(event.id)

    if (!existing) {
      await prisma.appointment.create({
        data: {
          title: stripCrmPrefix(event.summary),
          description: event.description ?? null,
          location: event.location ?? null,
          startTime: new Date(event.start),
          endTime: new Date(event.end),
          allDay: event.allDay,
          googleEventId: event.id,
          accountId,
        },
      })
      result.imported++
      continue
    }

    // Update CRM copy only when Google's is newer — CRM edits already push
    // out via the appointments API, so this settles rather than ping-pongs
    const gcalUpdated = event.updated ? new Date(event.updated) : null
    if (gcalUpdated && gcalUpdated > existing.updatedAt) {
      const cleanTitle = stripCrmPrefix(event.summary)
      const changed =
        existing.title !== cleanTitle ||
        (existing.location ?? null) !== (event.location ?? null) ||
        existing.startTime.getTime() !== new Date(event.start).getTime() ||
        existing.endTime.getTime() !== new Date(event.end).getTime() ||
        existing.allDay !== event.allDay
      if (changed) {
        await prisma.appointment.update({
          where: { id: existing.id },
          data: {
            title: cleanTitle,
            location: event.location ?? null,
            startTime: new Date(event.start),
            endTime: new Date(event.end),
            allDay: event.allDay,
          },
        })
        result.updated++
      }
    }
  }

  // ── Deletions: linked appointments missing from Google were deleted there.
  // Skip when the Google list hit its cap — absence wouldn't prove deletion.
  if (gcalEvents.length < GCAL_MAX_RESULTS) {
    for (const appt of appointments) {
      if (appt.googleEventId && !gcalIds.has(appt.googleEventId)) {
        await prisma.appointment.delete({ where: { id: appt.id } })
        result.deleted++
      }
    }
  }

  // ── CRM → Google: push appointments that were never linked ────────────────
  for (const appt of appointments) {
    if (appt.googleEventId) continue
    try {
      const googleEventId = await createCalendarEvent(config, {
        summary: `[CRM] ${appt.title}`,
        description: appt.description ?? undefined,
        location: appt.location ?? undefined,
        allDay: appt.allDay,
        startIso: appt.startTime.toISOString(),
        endIso: appt.endTime.toISOString(),
      })
      await prisma.appointment.update({ where: { id: appt.id }, data: { googleEventId } })
      result.pushed++
    } catch (e) {
      console.error(`Calendar push failed for appointment ${appt.id}:`, e)
    }
  }

  return result
}
