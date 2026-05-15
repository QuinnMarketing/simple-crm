import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

type P = { params: Promise<{ platform: string }> }

function b64(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

export async function GET(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.redirect(new URL('/login', req.url))

  const { platform } = await params
  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) return NextResponse.json({ error: 'No account selected — master_admin must pass ?account=ID' }, { status: 400 })
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const state = b64({ accountId, platform })
  const redirect = `${base}/api/social/callback/${platform}`

  if (platform === 'facebook' || platform === 'instagram') {
    const appId = process.env.FACEBOOK_APP_ID
    if (!appId) return NextResponse.json({ error: 'FACEBOOK_APP_ID not configured' }, { status: 500 })
    const scopes = 'pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publishing'
    const url = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`
    return NextResponse.redirect(url)
  }

  if (platform === 'google_business') {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
    if (!clientId) return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
    const scopes = 'https://www.googleapis.com/auth/business.manage'
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`
    return NextResponse.redirect(url)
  }

  if (platform === 'linkedin') {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID not configured' }, { status: 500 })
    const scopes = 'openid profile email w_member_social'
    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scopes)}&state=${state}`
    return NextResponse.redirect(url)
  }

  return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
}
