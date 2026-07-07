import { prisma } from '@/lib/prisma'
import { publishPost } from '@/lib/social-publish'
import { syncAccountReviews } from '@/lib/review-sync'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { NextResponse } from 'next/server'

// Publishes posts AND syncs Google reviews (with AI auto-replies) — Hobby
// plan allows only two cron jobs, so review sync shares this daily slot
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const due = await prisma.socialPost.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
    select: { id: true },
  })

  const results = await Promise.allSettled(due.map(p => publishPost(p.id)))
  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length

  // Daily review sync for every account with Google Business connected —
  // this is what makes auto-replies happen without anyone clicking Sync
  const gbpAccounts = await prisma.accountIntegration.findMany({
    where: { platform: 'google_business', enabled: true },
    select: { accountId: true },
  })

  let reviewsSynced = 0
  let autoReplied = 0
  const reviewErrors: string[] = []
  for (const { accountId } of gbpAccounts) {
    try {
      const r = await syncAccountReviews(accountId)
      reviewsSynced += r.created + r.updated
      autoReplied += r.autoReplied
      reviewErrors.push(...r.errors)
    } catch (e) {
      reviewErrors.push(`${accountId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({
    processed: due.length,
    succeeded,
    reviewAccounts: gbpAccounts.length,
    reviewsSynced,
    autoReplied,
    reviewErrors,
  })
}
