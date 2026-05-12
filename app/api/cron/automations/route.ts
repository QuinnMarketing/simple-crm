import { runPendingQuoteFollowups, runAppointmentReminderAutomations } from '@/lib/automations'
import { NextResponse } from 'next/server'

// Runs hourly via Vercel cron (vercel.json). Can also be called manually.
// If CRON_SECRET is set, pass it as ?secret=... or Authorization: Bearer ...
export async function GET(req: Request) {
  // Vercel's own cron runner sets this header — always allow it
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'

  if (!isVercelCron) {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const url = new URL(req.url)
      const provided = url.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
      if (provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
  }

  const [quotes, reminders] = await Promise.all([
    runPendingQuoteFollowups(),
    runAppointmentReminderAutomations(),
  ])

  return NextResponse.json({ ok: true, quotes, reminders })
}
