import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Google OAuth not configured — set GOOGLE_CALENDAR_CLIENT_ID' }, { status: 500 })

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) return NextResponse.json({ error: 'No account — master_admin must pass ?account=ID' }, { status: 400 })

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const scopes = [
    'https://www.googleapis.com/auth/adwords',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/integrations/google/callback`,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: Buffer.from(accountId).toString('base64url'),
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
