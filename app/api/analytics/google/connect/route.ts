import { auth } from '@/auth'
import { getAnalyticsAuthUrl } from '@/lib/google-analytics'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GOOGLE_ANALYTICS_CLIENT_ID && !process.env.GOOGLE_CALENDAR_CLIENT_ID) {
    return NextResponse.json({ error: 'Google OAuth not configured — set GOOGLE_ANALYTICS_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_ID' }, { status: 500 })
  }

  const accountId = session.user.accountId
  if (!accountId) {
    return NextResponse.json(
      { error: 'No account associated with your user.' },
      { status: 400 }
    )
  }

  return NextResponse.redirect(getAnalyticsAuthUrl(accountId))
}
