import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAccountFilter } from '@/lib/account-scope'
import { syncAccountReviews } from '@/lib/review-sync'

// Location migration + per-location review fetch + AI auto-replies can
// comfortably exceed the 10s default
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountParam } = await req.json()
  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })

  try {
    const result = await syncAccountReviews(accountId)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
