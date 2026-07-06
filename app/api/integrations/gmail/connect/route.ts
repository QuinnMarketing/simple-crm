import { auth } from '@/auth'
import { getAuthUrl } from '@/lib/gmail'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GOOGLE_GMAIL_CLIENT_ID && !process.env.GOOGLE_CALENDAR_CLIENT_ID) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
  }

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) {
    return NextResponse.json({ error: 'No account selected — master_admin must pass ?account=ID' }, { status: 400 })
  }

  return NextResponse.redirect(getAuthUrl(accountId))
}
