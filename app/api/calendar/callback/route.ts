import { prisma } from '@/lib/prisma'
import { exchangeCode } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const redirectBase = `${process.env.NEXTAUTH_URL}/settings`

  if (error || !code || !state) {
    return NextResponse.redirect(`${redirectBase}?gcal=error`)
  }

  let accountId: string
  try {
    accountId = Buffer.from(state, 'base64url').toString()
  } catch {
    return NextResponse.redirect(`${redirectBase}?gcal=error`)
  }

  try {
    const { refreshToken, email } = await exchangeCode(code)
    await prisma.accountIntegration.upsert({
      where: { accountId_platform: { accountId, platform: 'google_calendar' } },
      create: {
        accountId,
        platform: 'google_calendar',
        config: JSON.stringify({ refreshToken, email }),
        enabled: true,
      },
      update: {
        config: JSON.stringify({ refreshToken, email }),
        enabled: true,
      },
    })
    return NextResponse.redirect(`${redirectBase}?gcal=connected`)
  } catch (e) {
    console.error('GCal callback error:', e)
    return NextResponse.redirect(`${redirectBase}?gcal=error`)
  }
}
