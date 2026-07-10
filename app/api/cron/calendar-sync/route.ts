import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { syncGoogleCalendar } from '@/lib/calendar-sync'
import { NextResponse } from 'next/server'

// Runs via Vercel cron (vercel.json). Can also be called manually with
// CRON_SECRET as ?secret=... or Authorization: Bearer ...
// Two-way syncs every account with a connected Google Calendar so externally
// created events (e.g. Fresha bookings) appear as CRM appointments and
// unpushed CRM appointments reach Google. Live availability doesn't depend on
// this — the booking flow also checks Google free/busy directly.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connected = await prisma.accountIntegration.findMany({
    where: { platform: 'google_calendar', enabled: true },
    select: { accountId: true },
  })

  const results: Record<string, unknown> = {}
  for (const { accountId } of connected) {
    try {
      results[accountId] = await syncGoogleCalendar(accountId)
    } catch (e) {
      console.error(`Calendar sync failed for account ${accountId}:`, e)
      results[accountId] = { error: true }
    }
  }

  return NextResponse.json({ ok: true, accounts: connected.length, results })
}
