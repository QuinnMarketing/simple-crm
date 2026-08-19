import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) return NextResponse.json({ error: 'FACEBOOK_APP_ID not configured' }, { status: 500 })

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) return NextResponse.json({ error: 'No account — master_admin must pass ?account=ID' }, { status: 400 })

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  // Lead Ads only needs these three. Posting/Instagram scopes are omitted
  // because this app hasn't had those permissions enabled, and requesting a
  // permission the app lacks blocks the entire OAuth dialog ("Invalid Scopes").
  const scopes = [
    'pages_show_list',
    'pages_manage_metadata', // subscribe the page to our leadgen webhook
    'leads_retrieval',       // read Instant Form lead answers via the Graph API
  ].join(',')

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${base}/api/integrations/meta/callback`,
    scope: scopes,
    state: Buffer.from(accountId).toString('base64url'),
    response_type: 'code',
  })

  return NextResponse.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params}`)
}
