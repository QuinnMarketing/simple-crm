import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { listAvailableLocations, connectLocations, type GBPLocation } from '@/lib/google-reviews'

// listAvailableLocations retries once after a 20s backoff on GBP quota errors
export const maxDuration = 60

function resolveAccountId(sessionUser: Parameters<typeof getAccountFilter>[0], accountParam: string | null) {
  const filter = getAccountFilter(sessionUser, accountParam)
  return typeof filter.accountId === 'string' ? filter.accountId : null
}

// GET — list every location the Google account manages + which are connected
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = resolveAccountId(session.user, req.nextUrl.searchParams.get('account'))
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })

  try {
    const [available, connected] = await Promise.all([
      listAvailableLocations(accountId),
      prisma.socialAccount.findMany({
        where: { accountId, platform: 'google_business' },
        select: { platformId: true },
      }),
    ])
    const connectedIds = new Set(connected.map(c => c.platformId))
    return NextResponse.json({
      locations: available.map(l => ({ ...l, connected: connectedIds.has(l.id) })),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to list locations' }, { status: 400 })
  }
}

// POST — set the connected locations to exactly the given selection
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const accountId = resolveAccountId(session.user, body.accountParam ?? null)
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })

  const selected = (Array.isArray(body.locations) ? body.locations : []) as GBPLocation[]
  const valid = selected.filter(l => typeof l?.id === 'string' && l.id.startsWith('accounts/') && typeof l?.title === 'string')

  try {
    const count = await connectLocations(accountId, valid)
    return NextResponse.json({ count })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to connect locations' }, { status: 400 })
  }
}
