import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID not configured' }, { status: 500 })

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) return NextResponse.json({ error: 'No account — master_admin must pass ?account=ID' }, { status: 400 })

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  // Scopes available without special LinkedIn MDP approval
  // r_ads / r_ads_reporting require Marketing Developer Platform approval — add later if needed
  const scopes = [
    'openid',
    'profile',
    'email',
    'w_member_social',
    'r_organization_social',
    'rw_organization_admin',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${base}/api/integrations/linkedin/callback`,
    scope: scopes,
    state: Buffer.from(accountId).toString('base64url'),
  })

  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`)
}
