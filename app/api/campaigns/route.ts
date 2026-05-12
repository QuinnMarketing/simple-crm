import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)
  const campaigns = await prisma.emailCampaign.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { sends: true } } },
  })
  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const accountId = session.user.accountId ?? null

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: body.name ?? 'Untitled Campaign',
      subject: body.subject ?? '',
      bodyHtml: body.bodyHtml ?? '',
      bodyText: body.bodyText ?? '',
      segmentFilter: body.segmentFilter ? JSON.stringify(body.segmentFilter) : '{}',
      trackOpens: body.trackOpens ?? false,
      trackClicks: body.trackClicks ?? false,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      accountId,
    },
  })
  return NextResponse.json(campaign, { status: 201 })
}
