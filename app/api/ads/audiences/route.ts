import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountFilter } from '@/lib/account-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountId)

  const audiences = await prisma.adAudience.findMany({
    where: filter,
    include: { adPlatformAccount: { select: { platformAccountName: true, platform: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ audiences })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { adPlatformAccountId, name, description, segmentFilter } = body as {
    adPlatformAccountId: string
    name: string
    description?: string
    segmentFilter: Record<string, unknown>
  }

  const adAcct = await prisma.adPlatformAccount.findUnique({ where: { id: adPlatformAccountId } })
  if (!adAcct) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(adAcct.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const audience = await prisma.adAudience.create({
    data: {
      accountId: adAcct.accountId,
      adPlatformAccountId,
      platform: adAcct.platform,
      name,
      description: description ?? null,
      segmentFilter: JSON.stringify(segmentFilter ?? {}),
      status: 'pending',
    },
  })

  return NextResponse.json({ audience })
}
