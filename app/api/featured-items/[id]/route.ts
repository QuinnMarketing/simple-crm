import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'
import type { Session } from 'next-auth'

async function getFeaturedItem(id: string, user: Session['user']) {
  const item = await prisma.featuredItem.findUnique({ where: { id } })
  if (!item) return null
  const filter = getAccountFilter(user)
  if (typeof filter.accountId === 'string' && filter.accountId !== item.accountId) return null
  if (typeof filter.accountId === 'object' && 'in' in filter.accountId && !filter.accountId.in.includes(item.accountId)) return null
  return item
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'products'); if (gate) return gate

  const { id } = await params
  const item = await getFeaturedItem(id, session.user)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, priceLabel, imageUrl, ctaLabel, ctaHref, sortOrder, active } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = String(name).trim().slice(0, 160)
  if (description !== undefined) data.description = description ? String(description).trim().slice(0, 500) : null
  if (priceLabel !== undefined) data.priceLabel = priceLabel ? String(priceLabel).trim().slice(0, 40) : null
  if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl).trim().slice(0, 2000) : null
  if (ctaLabel !== undefined) data.ctaLabel = ctaLabel ? String(ctaLabel).trim().slice(0, 40) : null
  if (ctaHref !== undefined) data.ctaHref = ctaHref ? String(ctaHref).trim().slice(0, 300) : null
  if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10) || 0
  if (active !== undefined) data.active = Boolean(active)

  const updated = await prisma.featuredItem.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'products'); if (gate) return gate

  const { id } = await params
  const item = await getFeaturedItem(id, session.user)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.featuredItem.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
