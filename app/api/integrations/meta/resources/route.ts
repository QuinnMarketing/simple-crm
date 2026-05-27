import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'meta' } },
  })
  if (!integration?.enabled) return NextResponse.json({ error: 'Meta not connected' }, { status: 404 })

  try {
    const config = JSON.parse(integration.config)
    return NextResponse.json({
      userName: config.userName ?? '',
      adAccounts: config.adAccounts ?? [],
      pages: config.pages ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Invalid config' }, { status: 500 })
  }
}
