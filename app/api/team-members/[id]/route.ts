import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'
import type { Session } from 'next-auth'

async function getMember(id: string, user: Session['user']) {
  const member = await prisma.teamMember.findUnique({ where: { id } })
  if (!member) return null
  const filter = getAccountFilter(user)
  if (typeof filter.accountId === 'string' && filter.accountId !== member.accountId) return null
  if (typeof filter.accountId === 'object' && 'in' in filter.accountId && !filter.accountId.in.includes(member.accountId)) return null
  return member
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'team'); if (gate) return gate

  const { id } = await params
  const member = await getMember(id, session.user)
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, role, bio, photoUrl, sortOrder, active } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = String(name).trim().slice(0, 120)
  if (role !== undefined) data.role = role ? String(role).trim().slice(0, 100) : null
  if (bio !== undefined) data.bio = bio ? String(bio).trim().slice(0, 1000) : null
  if (photoUrl !== undefined) data.photoUrl = photoUrl ? String(photoUrl).trim().slice(0, 2000) : null
  if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10) || 0
  if (active !== undefined) data.active = Boolean(active)

  const updated = await prisma.teamMember.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'team'); if (gate) return gate

  const { id } = await params
  const member = await getMember(id, session.user)
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.teamMember.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
