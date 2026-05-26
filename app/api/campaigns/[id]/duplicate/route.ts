import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const original = await prisma.emailCampaign.findFirst({ where: { id, ...filter } })
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const copy = await prisma.emailCampaign.create({
    data: {
      name: `Copy of ${original.name}`,
      subject: original.subject,
      bodyHtml: original.bodyHtml,
      bodyText: original.bodyText,
      segmentFilter: original.segmentFilter,
      trackOpens: original.trackOpens,
      trackClicks: original.trackClicks,
      status: 'draft',
      accountId: original.accountId,
    },
  })

  return NextResponse.json(copy, { status: 201 })
}
