import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }
const PRICE_TYPES = ['fixed', 'from', 'free']

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.bookingType.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const type = await prisma.bookingType.update({
    where: { id },
    data: {
      ...(body.name?.trim() ? { name: String(body.name).trim().slice(0, 120) } : {}),
      ...('category' in body ? { category: body.category?.trim()?.slice(0, 60) || null } : {}),
      ...('description' in body ? { description: body.description?.trim()?.slice(0, 500) || null } : {}),
      ...('durationMin' in body ? { durationMin: Math.max(5, Math.min(1440, Number(body.durationMin) || 60)) } : {}),
      ...('price' in body ? { price: body.price != null && body.price !== '' ? Math.max(0, Number(body.price)) : null } : {}),
      ...('priceType' in body && PRICE_TYPES.includes(body.priceType) ? { priceType: body.priceType } : {}),
      ...('bufferBefore' in body ? { bufferBefore: Math.max(0, Math.min(240, Number(body.bufferBefore) || 0)) } : {}),
      ...('bufferAfter' in body ? { bufferAfter: Math.max(0, Math.min(240, Number(body.bufferAfter) || 0)) } : {}),
      ...('color' in body ? { color: body.color?.trim()?.slice(0, 20) || null } : {}),
      ...('onlineBookable' in body ? { onlineBookable: Boolean(body.onlineBookable) } : {}),
      ...('active' in body ? { active: Boolean(body.active) } : {}),
      ...('sortOrder' in body ? { sortOrder: Number(body.sortOrder) || 0 } : {}),
    },
  })
  return NextResponse.json(type)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.bookingType.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.bookingType.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
