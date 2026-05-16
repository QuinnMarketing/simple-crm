import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import type { Session } from 'next-auth'

async function getItem(id: string, user: Session['user']) {
  const item = await prisma.priceItem.findUnique({ where: { id } })
  if (!item) return null
  const filter = getAccountFilter(user)
  if (typeof filter.accountId === 'string' && filter.accountId !== item.accountId) return null
  if (typeof filter.accountId === 'object' && 'in' in filter.accountId && !filter.accountId.in.includes(item.accountId)) return null
  return item
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const item = await getItem(id, session.user)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, price, unit, category, sku, active } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = String(name).trim().slice(0, 200)
  if (description !== undefined) data.description = description ? String(description).slice(0, 1000) : null
  if (price !== undefined) data.price = parseFloat(price)
  if (unit !== undefined) data.unit = String(unit).slice(0, 50)
  if (category !== undefined) data.category = category ? String(category).trim().slice(0, 100) : null
  if (sku !== undefined) data.sku = sku ? String(sku).trim().slice(0, 100) : null
  if (active !== undefined) data.active = Boolean(active)

  const updated = await prisma.priceItem.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const item = await getItem(id, session.user)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.priceItem.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
