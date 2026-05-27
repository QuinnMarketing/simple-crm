import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state') ?? ''
  const oauthError = searchParams.get('error')

  const accountId = (() => {
    try { return Buffer.from(stateRaw, 'base64url').toString() } catch { return '' }
  })()

  const acctParam = accountId ? `&account=${accountId}` : ''
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/settings?google=error&msg=${encodeURIComponent(msg.slice(0, 120))}${acctParam}`, req.url))

  if (oauthError) return fail(oauthError + (searchParams.get('error_description') ? ': ' + searchParams.get('error_description') : ''))
  if (!code) return fail('No code returned from Google')
  if (!accountId) return fail('No account ID in state')

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${base}/api/integrations/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error_description ?? tokenData.error ?? 'Token exchange failed')
    if (!tokenData.refresh_token) throw new Error('No refresh token returned — try again (Google only issues refresh tokens on first grant or after revoking access)')

    let email = ''
    try {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (infoRes.ok) email = (await infoRes.json()).email ?? ''
    } catch { /* best-effort */ }

    await prisma.accountIntegration.upsert({
      where: { accountId_platform: { accountId, platform: 'google' } },
      create: {
        accountId,
        platform: 'google',
        config: JSON.stringify({ refreshToken: tokenData.refresh_token, email }),
        enabled: true,
      },
      update: {
        config: JSON.stringify({ refreshToken: tokenData.refresh_token, email }),
        enabled: true,
      },
    })

    const acct = accountId ? `&account=${accountId}` : ''
    return NextResponse.redirect(new URL(`/settings?google=connected${acct}`, req.url))
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
