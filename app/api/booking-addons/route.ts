import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const body = await req.json()
  const bookingTypeId = String(body.bookingTypeId ?? '')
  if (!bookingTypeId) return NextResponse.json({ error: 'bookingTypeId required' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // The parent service must belong to the caller's account
  const filter = getAccountFilter(session.user)
  const type = await prisma.bookingType.findFirst({ where: { id: bookingTypeId, ...filter }, select: { id: true } })
  if (!type) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  const count = await prisma.bookingAddon.count({ where: { bookingTypeId } })
  const addon = await prisma.bookingAddon.create({
    data: {
      bookingTypeId,
      name: String(body.name).trim().slice(0, 120),
      price: body.price != null && body.price !== '' ? Math.max(0, Number(body.price)) : null,
      durationMin: Math.max(0, Math.min(480, Number(body.durationMin) || 0)),
      active: body.active !== false,
      sortOrder: count,
    },
  })
  return NextResponse.json(addon, { status: 201 })
}
