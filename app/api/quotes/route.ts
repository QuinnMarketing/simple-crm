import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

const INACTIVE = new Set(['cancelled', 'declined'])

async function syncLeadValue(leadId: string) {
  const active = await prisma.quote.findFirst({
    where: { leadId, status: { notIn: ['cancelled', 'declined'] } },
    orderBy: { updatedAt: 'desc' },
  })
  await prisma.lead.update({
    where: { id: leadId },
    data: { value: active?.total ?? null },
  })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leadId = req.nextUrl.searchParams.get('leadId')
  const type = req.nextUrl.searchParams.get('type')
  const filter = getAccountFilter(session.user)

  const quotes = await prisma.quote.findMany({
    where: {
      ...filter,
      ...(leadId ? { leadId } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { lead: { select: { id: true, name: true } } },
  })
  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId ?? null
  const body = await req.json()
  const { type, status = 'draft', lineItems = [], taxRate = 10, notes, issuedAt, dueAt, leadId } = body

  if (!type || !['quote', 'invoice'].includes(type)) {
    return NextResponse.json({ error: 'type must be quote or invoice' }, { status: 400 })
  }

  const subtotal: number = lineItems.reduce((s: number, li: { quantity: number; unitPrice: number }) => s + li.quantity * li.unitPrice, 0)
  const taxAmount = subtotal * taxRate / 100
  const total = subtotal + taxAmount

  const count = await prisma.quote.count({ where: { accountId, type } })
  const number = type === 'quote'
    ? `Q-${String(count + 1).padStart(3, '0')}`
    : `INV-${String(count + 1).padStart(3, '0')}`

  const quote = await prisma.quote.create({
    data: {
      type, number, status,
      lineItems: JSON.stringify(lineItems),
      subtotal, taxRate, taxAmount, total,
      notes: notes || null,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
      dueAt: dueAt ? new Date(dueAt) : null,
      leadId: leadId || null,
      accountId,
    },
  })

  if (leadId && !INACTIVE.has(status)) {
    await syncLeadValue(leadId)
  }

  after(() => logAudit({ accountId, userId: session.user.id, userEmail: session.user.email, action: 'quote.created', entityType: 'quote', entityId: quote.id, entityLabel: `${quote.type === 'invoice' ? 'Invoice' : 'Quote'} ${quote.number}`, ipAddress: getIp(req) }))
  return NextResponse.json(quote, { status: 201 })
}
