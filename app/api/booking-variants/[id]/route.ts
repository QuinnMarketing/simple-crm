import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

async function ownedVariant(id: string, user: Parameters<typeof getAccountFilter>[0]) {
  const filter = getAccountFilter(user)
  return prisma.bookingVariant.findFirst({ where: { id, bookingType: { is: filter } } })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const { id } = await params
  const existing = await ownedVariant(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const variant = await prisma.bookingVariant.update({
    where: { id },
    data: {
      ...(body.name?.trim() ? { name: String(body.name).trim().slice(0, 120) } : {}),
      ...('durationMin' in body ? { durationMin: Math.max(5, Math.min(1440, Number(body.durationMin) || 60)) } : {}),
      ...('price' in body ? { price: body.price != null && body.price !== '' ? Math.max(0, Number(body.price)) : null } : {}),
      ...('active' in body ? { active: Boolean(body.active) } : {}),
    },
  })
  return NextResponse.json(variant)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const { id } = await params
  const existing = await ownedVariant(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.bookingVariant.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
