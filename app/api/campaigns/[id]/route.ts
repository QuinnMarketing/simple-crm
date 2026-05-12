import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const campaign = await prisma.emailCampaign.findFirst({
    where: { id, ...filter },
    include: {
      sends: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, status: true, openedAt: true, clickedAt: true, sentAt: true, error: true },
      },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const filter = getAccountFilter(session.user)

  const existing = await prisma.emailCampaign.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = body.name
  if ('subject' in body) updates.subject = body.subject
  if ('bodyHtml' in body) updates.bodyHtml = body.bodyHtml
  if ('bodyText' in body) updates.bodyText = body.bodyText
  if ('segmentFilter' in body) updates.segmentFilter = JSON.stringify(body.segmentFilter)
  if ('trackOpens' in body) updates.trackOpens = body.trackOpens
  if ('trackClicks' in body) updates.trackClicks = body.trackClicks
  if ('scheduledAt' in body) updates.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
  if ('status' in body) updates.status = body.status

  const campaign = await prisma.emailCampaign.update({ where: { id }, data: updates })
  return NextResponse.json(campaign)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const existing = await prisma.emailCampaign.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.emailCampaign.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
