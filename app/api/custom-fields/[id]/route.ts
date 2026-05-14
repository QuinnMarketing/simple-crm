import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const accountFilter = getAccountFilter(session.user)

  const existing = await prisma.customField.findFirst({ where: { id, ...accountFilter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if ('name' in body && body.name?.trim()) updates.name = body.name.trim()
  if ('type' in body) updates.type = body.type
  if ('options' in body) updates.options = body.options ? JSON.stringify(body.options) : null
  if ('required' in body) updates.required = body.required
  if ('order' in body) updates.order = body.order

  const field = await prisma.customField.update({ where: { id }, data: updates })
  return NextResponse.json(field)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const accountFilter = getAccountFilter(session.user)

  const existing = await prisma.customField.findFirst({ where: { id, ...accountFilter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.customField.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
