import { auth } from '@/auth'
import { getAnalyticsAuthUrl } from '@/lib/google-analytics'
import { resolveConnectAccountId } from '@/lib/oauth-account'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GOOGLE_ANALYTICS_CLIENT_ID && !process.env.GOOGLE_CALENDAR_CLIENT_ID) {
    return NextResponse.json({ error: 'Google OAuth not configured — set GOOGLE_ANALYTICS_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_ID' }, { status: 500 })
  }

  const accountId = resolveConnectAccountId(session.user, req.nextUrl.searchParams.get('account'))
  if (!accountId) {
    return NextResponse.json(
      { error: 'No account selected — master_admin must pass ?account=ID' },
      { status: 400 }
    )
  }

  return NextResponse.redirect(getAnalyticsAuthUrl(accountId))
}
