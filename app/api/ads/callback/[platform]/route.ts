import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode as exchangeGoogleCode } from '@/lib/ads/google-ads-api'
import { exchangeCode as exchangeMetaCode, listAdAccounts } from '@/lib/ads/meta-ads'

type P = { params: Promise<{ platform: string }> }

function decodeState(state: string): { accountId: string; platform: string } {
  try { return JSON.parse(Buffer.from(state, 'base64url').toString()) } catch { return { accountId: '', platform: '' } }
}

function adsRedirect(base: string, qs: string) {
  return NextResponse.redirect(`${base}/ads?${qs}`)
}

export async function GET(req: NextRequest, { params }: P) {
  const { platform } = await params
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const stateRaw = searchParams.get('state') ?? ''
  const { accountId } = decodeState(stateRaw)
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (oauthError) {
    const msg = encodeURIComponent(oauthError + (searchParams.get('error_description') ? ': ' + searchParams.get('error_description') : ''))
    return adsRedirect(base, `ads_status=error&platform=${platform}&msg=${msg}`)
  }
  if (!code) return adsRedirect(base, `ads_status=error&platform=${platform}&msg=${encodeURIComponent('No auth code returned')}`)
  if (!accountId) return adsRedirect(base, `ads_status=error&platform=${platform}&msg=${encodeURIComponent('No account ID in state')}`)

  try {
    if (platform === 'google_ads') {
      const { refreshToken, email } = await exchangeGoogleCode(code)
      // Store pending token — user still needs to provide customer ID and developer token
      // We store in a temp AccountIntegration and finalize in the Accounts panel
      await prisma.accountIntegration.upsert({
        where: { accountId_platform: { accountId, platform: 'google_ads_pending' } },
        create: {
          accountId,
          platform: 'google_ads_pending',
          config: JSON.stringify({ refreshToken, email }),
          enabled: true,
        },
        update: {
          config: JSON.stringify({ refreshToken, email }),
          enabled: true,
        },
      })
      return adsRedirect(base, `ads_status=connected&platform=google_ads&step=configure`)
    }

    if (platform === 'meta_ads') {
      const { accessToken, email } = await exchangeMetaCode(code)
      // Discover ad accounts
      const adAccounts = await listAdAccounts(accessToken)

      for (const adAcct of adAccounts) {
        if (adAcct.accountStatus !== 1) continue // 1 = active
        await prisma.adPlatformAccount.upsert({
          where: {
            accountId_platform_platformAccountId: {
              accountId,
              platform: 'meta_ads',
              platformAccountId: adAcct.id,
            },
          },
          create: {
            accountId,
            platform: 'meta_ads',
            platformAccountId: adAcct.id,
            platformAccountName: adAcct.name,
            accessToken,
            currencyCode: adAcct.currency || 'AUD',
            timezone: adAcct.timezone || 'Australia/Sydney',
            enabled: true,
          },
          update: {
            accessToken,
            platformAccountName: adAcct.name,
            enabled: true,
          },
        })
      }

      // Also store email reference in AccountIntegration for settings display
      await prisma.accountIntegration.upsert({
        where: { accountId_platform: { accountId, platform: 'meta_ads' } },
        create: { accountId, platform: 'meta_ads', config: JSON.stringify({ email }), enabled: true },
        update: { config: JSON.stringify({ email }), enabled: true },
      })

      return adsRedirect(base, `ads_status=connected&platform=meta_ads`)
    }
  } catch (e) {
    console.error(`Ads OAuth callback error (${platform}):`, e)
    const msg = e instanceof Error ? encodeURIComponent(e.message.slice(0, 150)) : ''
    return adsRedirect(base, `ads_status=error&platform=${platform}&msg=${msg}`)
  }

  return adsRedirect(base, `ads_status=error&platform=${platform}`)
}
