import { runPendingQuoteFollowups, runAppointmentReminderAutomations, runIdleDealAlerts, runIdlePushAlerts } from '@/lib/automations'
import { sendCampaign } from '@/lib/email-campaign'
import { prisma } from '@/lib/prisma'
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

  // Fire any scheduled campaigns that are due
  const dueCampaigns = await prisma.emailCampaign.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
    select: { id: true },
  })
  const campaignResults = await Promise.allSettled(dueCampaigns.map((c) => sendCampaign(c.id)))
  const campaignsSent = campaignResults.filter((r) => r.status === 'fulfilled').length
  const campaignsFailed = campaignResults.filter((r) => r.status === 'rejected').length

  const [quotes, reminders, idleDeals, idlePush] = await Promise.all([
    runPendingQuoteFollowups(),
    runAppointmentReminderAutomations(),
    runIdleDealAlerts(),
    runIdlePushAlerts(),
  ])

  return NextResponse.json({ ok: true, quotes, reminders, idleDeals, idlePush, campaigns: { sent: campaignsSent, failed: campaignsFailed } })
}
