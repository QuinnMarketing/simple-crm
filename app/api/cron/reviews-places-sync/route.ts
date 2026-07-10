import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { syncAccountReviewsFromPlaces } from '@/lib/google-places-reviews'
import { NextResponse } from 'next/server'

// Daily pull of new Google reviews (via Places API, no OAuth) for every
// account that has a Google Place ID set in Review Settings. New reviews
// land as 'pending' — someone still approves them in the Reviews page
// before they reach the public widget.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await prisma.reviewSettings.findMany({
    where: { googlePlaceId: { not: null } },
    select: { accountId: true },
  })

  const results: Record<string, unknown> = {}
  for (const { accountId } of accounts) {
    try {
      results[accountId] = await syncAccountReviewsFromPlaces(accountId)
    } catch (e) {
      console.error(`Places review sync failed for account ${accountId}:`, e)
      results[accountId] = { error: e instanceof Error ? e.message : String(e) }
    }
  }

  return NextResponse.json({ ok: true, accounts: accounts.length, results })
}
