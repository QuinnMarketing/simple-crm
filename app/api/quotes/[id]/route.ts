import { auth } from '@/auth'
import { logAudit, auditDiff, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

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

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.quote.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status, lineItems, taxRate, notes, issuedAt, dueAt } = body

  const items = lineItems ?? JSON.parse(existing.lineItems)
  const rate = taxRate ?? existing.taxRate
  const subtotal: number = items.reduce((s: number, li: { quantity: number; unitPrice: number }) => s + li.quantity * li.unitPrice, 0)
  const taxAmount = subtotal * rate / 100
  const total = subtotal + taxAmount

  const quote = await prisma.quote.update({
    where: { id },
    data: {
      status: status ?? existing.status,
      lineItems: JSON.stringify(items),
      subtotal, taxRate: rate, taxAmount, total,
      notes: 'notes' in body ? (notes || null) : existing.notes,
      issuedAt: 'issuedAt' in body ? (issuedAt ? new Date(issuedAt) : null) : existing.issuedAt,
      dueAt: 'dueAt' in body ? (dueAt ? new Date(dueAt) : null) : existing.dueAt,
    },
  })

  if (existing.leadId) await syncLeadValue(existing.leadId)

  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'quote.updated', entityType: 'quote', entityId: quote.id, entityLabel: `${quote.type === 'invoice' ? 'Invoice' : 'Quote'} ${quote.number}`, changes: auditDiff({ status: existing.status, total: existing.total } as Record<string, unknown>, { status: quote.status, total: quote.total } as Record<string, unknown>), ipAddress: getIp(req) }))
  return NextResponse.json(quote)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.quote.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.quote.delete({ where: { id } })

  if (existing.leadId) await syncLeadValue(existing.leadId)

  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'quote.deleted', entityType: 'quote', entityId: id, entityLabel: `${existing.type === 'invoice' ? 'Invoice' : 'Quote'} ${existing.number}`, ipAddress: getIp(req) }))
  return NextResponse.json({ success: true })
}
