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
  const existing = await prisma.ganttTask.findFirst({ where: { id, project: { ...filter } } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { name, startDate, endDate, assignee, status, progress, notes } = await req.json()
  const task = await prisma.ganttTask.update({
    where: { id },
    data: {
      name: name?.trim() ?? existing.name,
      startDate: startDate ?? existing.startDate,
      endDate: endDate ?? existing.endDate,
      assignee: assignee?.trim() || null,
      status: status ?? existing.status,
      progress: typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : existing.progress,
      notes: notes?.trim() || null,
    },
  })
  return NextResponse.json(task)
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.ganttTask.findFirst({ where: { id, project: { ...filter } } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.ganttTask.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
