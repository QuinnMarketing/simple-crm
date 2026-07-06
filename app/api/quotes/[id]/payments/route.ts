import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

const VALID_METHODS = ['bank_transfer', 'cash', 'card', 'other']

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const quote = await prisma.quote.findFirst({ where: { id, ...filter } })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const payments = await prisma.payment.findMany({
    where: { quoteId: id },
    orderBy: { paidAt: 'desc' },
  })
  return NextResponse.json(payments)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const quote = await prisma.quote.findFirst({ where: { id, ...filter } })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.type !== 'invoice') return NextResponse.json({ error: 'Payments can only be recorded against invoices' }, { status: 400 })

  const body = await req.json()
  const amount = Number(body.amount)
  const method = VALID_METHODS.includes(body.method) ? body.method : 'other'
  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }

  const payment = await prisma.payment.create({
    data: { quoteId: id, amount, method, paidAt, notes, accountId: quote.accountId },
  })

  after(() => logAudit({
    accountId: quote.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'payment.recorded', entityType: 'quote', entityId: id, entityLabel: quote.number,
    changes: { amount, method }, ipAddress: getIp(req),
  }))

  return NextResponse.json(payment, { status: 201 })
}
