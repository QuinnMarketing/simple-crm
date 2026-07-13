import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

const TEXT_FIELDS = ['name', 'tagline', 'imageUrl', 'ageRange', 'gender', 'occupation', 'location', 'income', 'goals', 'painPoints', 'objections', 'channels', 'services', 'notes'] as const

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'target_customer'); if (gate) return gate

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.customerAvatar.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  for (const f of TEXT_FIELDS) {
    if (f in body) data[f] = typeof body[f] === 'string' ? (body[f].trim() || null) : null
  }
  if ('imageOptions' in body && Array.isArray(body.imageOptions)) {
    data.imageOptions = JSON.stringify(body.imageOptions)
  }

  // Setting this persona primary demotes the others for the account
  const makePrimary = body.isPrimary === true
  if (makePrimary) {
    await prisma.customerAvatar.updateMany({ where: { accountId: existing.accountId, NOT: { id } }, data: { isPrimary: false } })
    data.isPrimary = true
  }

  const avatar = await prisma.customerAvatar.update({ where: { id }, data })
  return NextResponse.json(avatar)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'target_customer'); if (gate) return gate

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.customerAvatar.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.customerAvatar.delete({ where: { id } })

  // If we removed the primary, promote another so the dashboard still has one
  if (existing.isPrimary) {
    const next = await prisma.customerAvatar.findFirst({
      where: { accountId: existing.accountId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (next) await prisma.customerAvatar.update({ where: { id: next.id }, data: { isPrimary: true } })
  }

  return NextResponse.json({ ok: true })
}
