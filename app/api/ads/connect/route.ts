import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl as getGoogleAuthUrl } from '@/lib/ads/google-ads-api'
import { getAuthUrl as getMetaAuthUrl } from '@/lib/ads/meta-ads'

function b64(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.redirect(new URL('/login', req.url))

  const { searchParams } = req.nextUrl
  const platform = searchParams.get('platform')
  const accountId = session.user.accountId ?? searchParams.get('account') ?? ''

  if (!accountId) {
    return NextResponse.json({ error: 'No account selected' }, { status: 400 })
  }

  const state = b64({ accountId, platform })

  if (platform === 'google_ads') {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.GOOGLE_CALENDAR_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured — set GOOGLE_ADS_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_ID' }, { status: 500 })
    }
    return NextResponse.redirect(getGoogleAuthUrl(state))
  }

  if (platform === 'meta_ads') {
    if (!process.env.FACEBOOK_APP_ID) {
      return NextResponse.json({ error: 'FACEBOOK_APP_ID not configured' }, { status: 500 })
    }
    return NextResponse.redirect(getMetaAuthUrl(state))
  }

  return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
}
