import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAccountFilter } from '@/lib/account-scope'
import { syncAccountReviewsFromPlaces } from '@/lib/google-places-reviews'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountParam } = await req.json()
  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })

  try {
    const result = await syncAccountReviewsFromPlaces(accountId)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
