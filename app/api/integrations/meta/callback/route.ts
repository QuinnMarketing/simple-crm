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
    NextResponse.redirect(new URL(`/settings?meta=error&msg=${encodeURIComponent(msg.slice(0, 120))}${acctParam}`, req.url))

  if (oauthError) return fail(oauthError + (searchParams.get('error_description') ? ': ' + searchParams.get('error_description') : ''))
  if (!code) return fail('No code returned from Meta')
  if (!accountId) return fail('No account ID in state')

  const appId = process.env.FACEBOOK_APP_ID!
  const appSecret = process.env.FACEBOOK_APP_SECRET!
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const redirectUri = `${base}/api/integrations/meta/callback`

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error?.message ?? 'Token exchange failed')

    // Exchange for long-lived token
    const longRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    )
    const longData = await longRes.json()
    const accessToken = longData.access_token ?? tokenData.access_token
    const expiresAt = longData.expires_in ? new Date(Date.now() + longData.expires_in * 1000).toISOString() : null

    // Get user info
    const userRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${accessToken}`)
    const user = await userRes.json()

    // Get accessible ad accounts
    const adsRes = await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name,currency&access_token=${accessToken}`)
    const adsData = adsRes.ok ? await adsRes.json() : { data: [] }

    // Get managed pages (for posting and CAPI)
    const pagesRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,name}&access_token=${accessToken}`)
    const pagesData = pagesRes.ok ? await pagesRes.json() : { data: [] }

    await prisma.accountIntegration.upsert({
      where: { accountId_platform: { accountId, platform: 'meta' } },
      create: {
        accountId,
        platform: 'meta',
        config: JSON.stringify({
          accessToken,
          expiresAt,
          userId: user.id ?? '',
          userName: user.name ?? '',
          adAccounts: adsData.data ?? [],
          pages: (pagesData.data ?? []).map((p: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; name: string } }) => ({
            id: p.id,
            name: p.name,
            accessToken: p.access_token,
            instagram: p.instagram_business_account ?? null,
          })),
        }),
        enabled: true,
      },
      update: {
        config: JSON.stringify({
          accessToken,
          expiresAt,
          userId: user.id ?? '',
          userName: user.name ?? '',
          adAccounts: adsData.data ?? [],
          pages: (pagesData.data ?? []).map((p: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; name: string } }) => ({
            id: p.id,
            name: p.name,
            accessToken: p.access_token,
            instagram: p.instagram_business_account ?? null,
          })),
        }),
        enabled: true,
      },
    })

    const acct = accountId ? `&account=${accountId}` : ''
    return NextResponse.redirect(new URL(`/settings?meta=connected${acct}`, req.url))
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
