import { auth } from '@/auth'
import { getAccountFilter } from '@/lib/account-scope'
import { syncGoogleCalendar } from '@/lib/calendar-sync'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountParam = req.nextUrl.searchParams.get('account')
  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) {
    return NextResponse.json({ error: 'Select a specific account to sync' }, { status: 400 })
  }

  try {
    const result = await syncGoogleCalendar(accountId)
    if (!result) {
      return NextResponse.json({ error: 'Google Calendar is not connected for this account' }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error('Calendar sync failed:', e)
    return NextResponse.json({ error: 'Sync failed — check the Google Calendar connection in Settings' }, { status: 500 })
  }
}
