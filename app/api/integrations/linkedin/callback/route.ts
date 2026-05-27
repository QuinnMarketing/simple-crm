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
    NextResponse.redirect(new URL(`/settings?linkedin=error&msg=${encodeURIComponent(msg.slice(0, 120))}${acctParam}`, req.url))

  if (oauthError) return fail(oauthError + (searchParams.get('error_description') ? ': ' + searchParams.get('error_description') : ''))
  if (!code) return fail('No code returned from LinkedIn')
  if (!accountId) return fail('No account ID in state')

  const clientId = process.env.LINKEDIN_CLIENT_ID!
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const redirectUri = `${base}/api/integrations/linkedin/callback`

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error_description ?? tokenData.error ?? 'Token exchange failed')

    const accessToken: string = tokenData.access_token
    const refreshToken: string | null = tokenData.refresh_token ?? null
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null

    // Get personal profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const profile = profileRes.ok ? await profileRes.json() : {}
    const personId = profile.sub ?? ''
    const personName = profile.name ?? (`${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim() || 'LinkedIn User')

    // Get organization admin roles (company pages)
    let organizations: { id: string; name: string }[] = []
    try {
      const orgsRes = await fetch(
        'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(id,localizedName)))',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json()
        organizations = (orgsData.elements ?? []).map((el: { 'organization~'?: { id: number; localizedName?: string } }) => ({
          id: String(el['organization~']?.id ?? ''),
          name: el['organization~']?.localizedName ?? 'Company Page',
        })).filter((o: { id: string }) => o.id)
      }
    } catch { /* best-effort */ }

    await prisma.accountIntegration.upsert({
      where: { accountId_platform: { accountId, platform: 'linkedin' } },
      create: {
        accountId,
        platform: 'linkedin',
        config: JSON.stringify({ accessToken, refreshToken, expiresAt, personId, personName, organizations }),
        enabled: true,
      },
      update: {
        config: JSON.stringify({ accessToken, refreshToken, expiresAt, personId, personName, organizations }),
        enabled: true,
      },
    })

    const acct = accountId ? `&account=${accountId}` : ''
    return NextResponse.redirect(new URL(`/settings?linkedin=connected${acct}`, req.url))
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
