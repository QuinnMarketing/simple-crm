import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type P = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const campaign = await prisma.adCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(campaign.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adSets = await prisma.adSet.findMany({
    where: { campaignId: id },
    include: { ads: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ adSets })
}
