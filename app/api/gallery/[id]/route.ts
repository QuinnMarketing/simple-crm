import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'
import type { Session } from 'next-auth'

async function getImage(id: string, user: Session['user']) {
  const image = await prisma.galleryImage.findUnique({ where: { id } })
  if (!image) return null
  const filter = getAccountFilter(user)
  if (typeof filter.accountId === 'string' && filter.accountId !== image.accountId) return null
  if (typeof filter.accountId === 'object' && 'in' in filter.accountId && !filter.accountId.in.includes(image.accountId)) return null
  return image
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'gallery'); if (gate) return gate

  const { id } = await params
  const image = await getImage(id, session.user)
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { caption, sortOrder, active } = body

  const data: Record<string, unknown> = {}
  if (caption !== undefined) data.caption = caption ? String(caption).trim().slice(0, 200) : null
  if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10) || 0
  if (active !== undefined) data.active = Boolean(active)

  const updated = await prisma.galleryImage.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'gallery'); if (gate) return gate

  const { id } = await params
  const image = await getImage(id, session.user)
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.galleryImage.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
