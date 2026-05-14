import { prisma } from '@/lib/prisma'
import { exchangeAnalyticsCode } from '@/lib/google-analytics'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const redirectBase = `${process.env.NEXTAUTH_URL}/settings`

  if (error || !code || !state) {
    return NextResponse.redirect(`${redirectBase}?ganalytics=error`)
  }

  let accountId: string
  try {
    accountId = Buffer.from(state, 'base64url').toString()
  } catch {
    return NextResponse.redirect(`${redirectBase}?ganalytics=error`)
  }

  try {
    const { refreshToken, email } = await exchangeAnalyticsCode(code)

    // Preserve existing propertyId if already configured
    let propertyId = ''
    const existing = await prisma.accountIntegration.findUnique({
      where: { accountId_platform: { accountId, platform: 'google_analytics' } },
    })
    try {
      if (existing?.config) {
        propertyId = (JSON.parse(existing.config) as { propertyId?: string }).propertyId ?? ''
      }
    } catch { /* ignore */ }

    await prisma.accountIntegration.upsert({
      where: { accountId_platform: { accountId, platform: 'google_analytics' } },
      create: {
        accountId,
        platform: 'google_analytics',
        config: JSON.stringify({ refreshToken, email, propertyId }),
        enabled: true,
      },
      update: {
        config: JSON.stringify({ refreshToken, email, propertyId }),
        enabled: true,
      },
    })
    return NextResponse.redirect(`${redirectBase}?ganalytics=connected`)
  } catch (e) {
    console.error('GA4 callback error:', e)
    return NextResponse.redirect(`${redirectBase}?ganalytics=error`)
  }
}
