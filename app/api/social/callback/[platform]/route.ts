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
  const stateRaw = searchParams.get('state') ?? ''
  const { accountId } = decodeState(stateRaw)

  if (!code || !accountId) return redirect(req, 'social=error')

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

      // Get GMB accounts and locations
      const acctRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const acctData = await acctRes.json()
      const accounts = acctData.accounts ?? []

      for (const acct of accounts.slice(0, 10)) {
        const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acct.name}/locations?readMask=name,title,storefrontAddress`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        const locData = await locRes.json()
        for (const loc of locData.locations ?? []) {
          await prisma.socialAccount.upsert({
            where: { accountId_platform_platformId: { accountId, platform: 'google_business', platformId: loc.name } },
            create: { accountId, platform: 'google_business', platformId: loc.name, name: loc.title ?? loc.name, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token ?? null },
            update: { name: loc.title ?? loc.name, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token ?? null },
          })
        }
      }
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

      const profileRes = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~digitalmediaAsset:playableStreams))', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const profile = await profileRes.json()
      const name = `${profile.localizedFirstName ?? ''} ${profile.localizedLastName ?? ''}`.trim() || 'LinkedIn Profile'
      const urn = `urn:li:person:${profile.id}`
      const pic = profile.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier ?? null
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
    return redirect(req, `social=error&platform=${platform}`)
  }

  return redirect(req, 'social=error')
}
