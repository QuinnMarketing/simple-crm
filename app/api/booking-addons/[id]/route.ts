import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// Confirms the add-on's parent service belongs to the caller's account
async function ownedAddon(id: string, user: Parameters<typeof getAccountFilter>[0]) {
  const filter = getAccountFilter(user)
  return prisma.bookingAddon.findFirst({ where: { id, bookingType: { is: filter } } })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const { id } = await params
  const existing = await ownedAddon(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const addon = await prisma.bookingAddon.update({
    where: { id },
    data: {
      ...(body.name?.trim() ? { name: String(body.name).trim().slice(0, 120) } : {}),
      ...('price' in body ? { price: body.price != null && body.price !== '' ? Math.max(0, Number(body.price)) : null } : {}),
      ...('durationMin' in body ? { durationMin: Math.max(0, Math.min(480, Number(body.durationMin) || 0)) } : {}),
      ...('active' in body ? { active: Boolean(body.active) } : {}),
    },
  })
  return NextResponse.json(addon)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const { id } = await params
  const existing = await ownedAddon(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.bookingAddon.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
