import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountFilter } from '@/lib/account-scope'
import { getCustomerInfo } from '@/lib/ads/google-ads-api'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountId)

  const accounts = await prisma.adPlatformAccount.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
  })

  // Check for pending Google Ads OAuth (needs customer ID configuration)
  const resolvedAccountId = accountId ?? session.user.accountId ?? ''
  const pendingGoogle = resolvedAccountId ? await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId: resolvedAccountId, platform: 'google_ads_pending' } },
  }) : null

  return NextResponse.json({
    accounts: accounts.map(a => ({
      id: a.id,
      platform: a.platform,
      platformAccountId: a.platformAccountId,
      platformAccountName: a.platformAccountName,
      currencyCode: a.currencyCode,
      timezone: a.timezone,
      enabled: a.enabled,
      syncedAt: a.syncedAt,
      createdAt: a.createdAt,
    })),
    pendingGoogleOAuth: pendingGoogle ? JSON.parse(pendingGoogle.config) : null,
  })
}

// POST: Finalize Google Ads connection (after OAuth) by providing customer ID + developer token
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { platform, customerId, developerToken, loginCustomerId } = body as {
    platform: string
    customerId?: string
    developerToken?: string
    loginCustomerId?: string
  }

  const accountId = session.user.accountId ?? body.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  if (platform === 'google_ads') {
    const pending = await prisma.accountIntegration.findUnique({
      where: { accountId_platform: { accountId, platform: 'google_ads_pending' } },
    })
    if (!pending) return NextResponse.json({ error: 'No pending Google Ads OAuth — connect first' }, { status: 400 })

    const { refreshToken } = JSON.parse(pending.config) as { refreshToken: string; email?: string }
    const cleanId = (customerId ?? '').replace(/-/g, '')
    const dt = developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''

    if (!cleanId) return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    if (!dt) return NextResponse.json({ error: 'Developer token is required' }, { status: 400 })

    // Verify by calling the API
    const cleanLoginId = (loginCustomerId ?? '').replace(/-/g, '').trim() || undefined
    let info: { id: string; name: string; currencyCode: string; timezone: string }
    let diagnostics: string[] = []
    try {
      info = await getCustomerInfo(refreshToken, dt, cleanId, diagnostics, cleanLoginId)
    } catch (e) {
      return NextResponse.json({
        error: `Verification failed: ${e instanceof Error ? e.message : String(e)}`,
        diagnostics,
      }, { status: 400 })
    }

    const adAcct = await prisma.adPlatformAccount.upsert({
      where: {
        accountId_platform_platformAccountId: {
          accountId,
          platform: 'google_ads',
          platformAccountId: info.id,
        },
      },
      create: {
        accountId,
        platform: 'google_ads',
        platformAccountId: info.id,
        platformAccountName: info.name,
        refreshToken,
        developerToken: dt,
        loginCustomerId: cleanLoginId ?? null,
        currencyCode: info.currencyCode,
        timezone: info.timezone,
        enabled: true,
      },
      update: {
        platformAccountName: info.name,
        refreshToken,
        developerToken: dt,
        loginCustomerId: cleanLoginId ?? null,
        currencyCode: info.currencyCode,
        timezone: info.timezone,
        enabled: true,
      },
    })

    // Clean up pending record
    await prisma.accountIntegration.delete({
      where: { accountId_platform: { accountId, platform: 'google_ads_pending' } },
    }).catch(() => {})

    return NextResponse.json({ account: adAcct })
  }

  return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
}
