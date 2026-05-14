import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.ganttProject.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { name, description, color } = await req.json()
  const project = await prisma.ganttProject.update({
    where: { id },
    data: {
      name: name?.trim() ?? existing.name,
      description: description?.trim() || null,
      color: color ?? existing.color,
    },
  })
  return NextResponse.json(project)
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.ganttProject.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.ganttProject.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
