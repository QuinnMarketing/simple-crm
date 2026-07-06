import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

function calcTotals(lineItems: { quantity: number; unitCost: number; markup: number }[]) {
  const subtotal = lineItems.reduce((s, li) => {
    const base = (li.quantity ?? 0) * (li.unitCost ?? 0)
    return s + base * (1 + (li.markup ?? 0) / 100)
  }, 0)
  return { subtotal, total: subtotal }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const takeoff = await prisma.takeoff.findFirst({
    where: { id, ...filter },
    include: {
      project: { select: { id: true, name: true, color: true } },
      lead: { select: { id: true, name: true } },
    },
  })
  if (!takeoff) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(takeoff)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const existing = await prisma.takeoff.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, status, lineItems, notes, projectId, leadId } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (description !== undefined) data.description = description || null
  if (status !== undefined) data.status = status
  if (notes !== undefined) data.notes = notes || null
  if (projectId !== undefined) data.projectId = projectId || null
  if (leadId !== undefined) data.leadId = leadId || null

  if (lineItems !== undefined) {
    const items = Array.isArray(lineItems) ? lineItems : []
    const { subtotal, total } = calcTotals(items)
    data.lineItems = JSON.stringify(items)
    data.subtotal = subtotal
    data.total = total
  }

  const takeoff = await prisma.takeoff.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, name: true, color: true } },
      lead: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(takeoff)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const existing = await prisma.takeoff.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.takeoff.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
