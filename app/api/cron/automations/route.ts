import { runPendingQuoteFollowups, runAppointmentReminderAutomations } from '@/lib/automations'
import { NextResponse } from 'next/server'

// Call this endpoint hourly to fire time-based automations.
// Protect with CRON_SECRET env var — pass as ?secret=... or Authorization: Bearer ...
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const provided = url.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const [quotes, reminders] = await Promise.all([
    runPendingQuoteFollowups(),
    runAppointmentReminderAutomations(),
  ])

  return NextResponse.json({ ok: true, quotes, reminders })
}
