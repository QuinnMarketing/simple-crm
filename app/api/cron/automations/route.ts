import { runPendingQuoteFollowups, runAppointmentReminderAutomations, runIdleDealAlerts, runIdlePushAlerts } from '@/lib/automations'
import { resumeWaitingRuns, runScheduledAutomations } from '@/lib/automation-engine'
import { sendCampaign } from '@/lib/email-campaign'
import { syncAllEmailAccounts } from '@/lib/email-sync'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { NextResponse } from 'next/server'

// Runs via Vercel cron (vercel.json). Can also be called manually with
// CRON_SECRET as ?secret=... or Authorization: Bearer ...
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fire any scheduled campaigns that are due
  const dueCampaigns = await prisma.emailCampaign.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
    select: { id: true },
  })
  const campaignResults = await Promise.allSettled(dueCampaigns.map((c) => sendCampaign(c.id)))
  const campaignsSent = campaignResults.filter((r) => r.status === 'fulfilled').length
  const campaignsFailed = campaignResults.filter((r) => r.status === 'rejected').length

  const [quotes, reminders, idleDeals, idlePush, resumed, scheduled, emailSync] = await Promise.all([
    runPendingQuoteFollowups(),
    runAppointmentReminderAutomations(),
    runIdleDealAlerts(),
    runIdlePushAlerts(),
    resumeWaitingRuns(),
    runScheduledAutomations(),
    syncAllEmailAccounts(),
  ])

  return NextResponse.json({ ok: true, quotes, reminders, idleDeals, idlePush, resumed, scheduled, emailSync, campaigns: { sent: campaignsSent, failed: campaignsFailed } })
}
