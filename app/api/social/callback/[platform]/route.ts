import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type P = { params: Promise<{ platform: string }> }

function decodeState(state: string): { accountId: string; platform: string } {
  try { return JSON.parse(Buffer.from(state, 'base64url').toString()) } catch { return { accountId: '', platform: '' } }
}

function redirect(req: NextRequest, qs: string) {
  return NextResponse.redirect(new URL(`/social?${qs}`, req.url))
}

export async function GET(req: NextRequest, { params }: P) {
  const { platform } = await params
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const stateRaw = searchParams.get('state') ?? ''
  const { accountId } = decodeState(stateRaw)

  if (oauthError) {
    const msg = encodeURIComponent(oauthError + (searchParams.get('error_description') ? ': ' + searchParams.get('error_description') : ''))
    return redirect(req, `social=error&platform=${platform}&msg=${msg}`)
  }
  if (!code) return redirect(req, `social=error&platform=${platform}&msg=${encodeURIComponent('No code returned from provider — check redirect URI registration')}`)
  if (!accountId) return redirect(req, `social=error&platform=${platform}&msg=${encodeURIComponent('No account ID in state — master_admin must select an account first')}`)

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const redirectUri = `${base}/api/social/callback/${platform}`

  try {
    // ── Facebook / Instagram ──────────────────────────────────────────────
    if (platform === 'facebook' || platform === 'instagram') {
      const appId = process.env.FACEBOOK_APP_ID!
      const appSecret = process.env.FACEBOOK_APP_SECRET!

      // Exchange code for user token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
      )
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error?.message ?? 'Token exchange failed')
      const userToken = tokenData.access_token

      // Get managed pages (includes linked IG accounts)
      const pagesRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=id,name,picture,access_token,instagram_business_account{id,name,profile_picture_url}&access_token=${userToken}`)
      const pagesData = await pagesRes.json()
      if (!pagesRes.ok || pagesData.error) throw new Error(pagesData.error?.message ?? 'Pages fetch failed')

      for (const page of pagesData.data ?? []) {
        // Save Facebook page
        await prisma.socialAccount.upsert({
          where: { accountId_platform_platformId: { accountId, platform: 'facebook', platformId: page.id } },
          create: { accountId, platform: 'facebook', platformId: page.id, name: page.name, pictureUrl: page.picture?.data?.url ?? null, accessToken: page.access_token },
          update: { name: page.name, pictureUrl: page.picture?.data?.url ?? null, accessToken: page.access_token },
        })

        // If this page has a linked Instagram business account, save that too
        if (page.instagram_business_account?.id) {
          const ig = page.instagram_business_account
          await prisma.socialAccount.upsert({
            where: { accountId_platform_platformId: { accountId, platform: 'instagram', platformId: ig.id } },
            create: { accountId, platform: 'instagram', platformId: ig.id, name: ig.name ?? page.name + ' (Instagram)', pictureUrl: ig.profile_picture_url ?? null, accessToken: page.access_token },
            update: { name: ig.name ?? page.name + ' (Instagram)', pictureUrl: ig.profile_picture_url ?? null, accessToken: page.access_token },
          })
        }
      }
      return redirect(req, 'social=connected&platform=facebook')
    }

    // ── Google Business Profile ───────────────────────────────────────────
    if (platform === 'google_business') {
      const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID!
      const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error_description ?? 'Google token exchange failed')
      if (!tokenData.refresh_token) throw new Error('No refresh token returned — try disconnecting and reconnecting with prompt=consent')

      // Store credentials only — location discovery happens explicitly via the UI
      // to avoid hitting GBP API quota limits during the OAuth flow.
      await prisma.accountIntegration.upsert({
        where: { accountId_platform: { accountId, platform: 'google_business' } },
        create: { accountId, platform: 'google_business', config: JSON.stringify({ refreshToken: tokenData.refresh_token }), enabled: true },
        update: { config: JSON.stringify({ refreshToken: tokenData.refresh_token }), enabled: true },
      })

      return redirect(req, 'social=connected&platform=google_business')
    }

    // ── LinkedIn ──────────────────────────────────────────────────────────
    if (platform === 'linkedin') {
      const clientId = process.env.LINKEDIN_CLIENT_ID!
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!

      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error_description ?? 'LinkedIn token exchange failed')

      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const profile = await profileRes.json()
      const fullName = profile.name ?? `${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim()
      const name = fullName || 'LinkedIn Profile'
      const urn = `urn:li:person:${profile.sub}`
      const pic = profile.picture ?? null
      const exp = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null

      await prisma.socialAccount.upsert({
        where: { accountId_platform_platformId: { accountId, platform: 'linkedin', platformId: urn } },
        create: { accountId, platform: 'linkedin', platformId: urn, name, pictureUrl: pic, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token ?? null, expiresAt: exp },
        update: { name, pictureUrl: pic, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token ?? null, expiresAt: exp },
      })
      return redirect(req, 'social=connected&platform=linkedin')
    }

  } catch (e) {
    console.error(`Social OAuth callback error (${platform}):`, e)
    const msg = e instanceof Error ? encodeURIComponent(e.message.slice(0, 120)) : ''
    return redirect(req, `social=error&platform=${platform}&msg=${msg}`)
  }

  return redirect(req, 'social=error')
}
