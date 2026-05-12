import { auth } from '@/auth'
import { getAuthUrl } from '@/lib/google-calendar'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID) {
    return NextResponse.json({ error: 'GOOGLE_CALENDAR_CLIENT_ID not configured' }, { status: 500 })
  }

  // Master admins have no accountId — they must select an account first
  const accountId = session.user.accountId
  if (!accountId) {
    return NextResponse.json(
      { error: 'No account associated with this user. Select an account before connecting Google Calendar.' },
      { status: 400 }
    )
  }

  return NextResponse.redirect(getAuthUrl(accountId))
}
