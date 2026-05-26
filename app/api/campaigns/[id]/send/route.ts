import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { sendCampaign } from '@/lib/email-campaign'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const campaign = await prisma.emailCampaign.findFirst({ where: { id, ...filter } })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (campaign.status === 'sending') return NextResponse.json({ error: 'Already sending' }, { status: 409 })

  try {
    const result = await sendCampaign(id)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed'
    await prisma.emailCampaign.update({ where: { id }, data: { status: 'failed', lastError: message } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
