import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string; paymentId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, paymentId } = await params
  const filter = getAccountFilter(session.user)
  const quote = await prisma.quote.findFirst({ where: { id, ...filter } })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const payment = await prisma.payment.findFirst({ where: { id: paymentId, quoteId: id } })
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.payment.delete({ where: { id: paymentId } })

  after(() => logAudit({
    accountId: quote.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'payment.deleted', entityType: 'quote', entityId: id, entityLabel: quote.number,
    changes: { amount: payment.amount }, ipAddress: getIp(req),
  }))

  return NextResponse.json({ success: true })
}
