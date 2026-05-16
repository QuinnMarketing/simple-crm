import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

async function getTask(id: string, user: Parameters<typeof getAccountFilter>[0]) {
  return prisma.task.findFirst({
    where: { id, ...getAccountFilter(user) },
    include: { lead: { select: { id: true, name: true } } },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getTask(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...('title' in body ? { title: body.title } : {}),
      ...('description' in body ? { description: body.description || null } : {}),
      ...('status' in body ? { status: body.status } : {}),
      ...('priority' in body ? { priority: body.priority } : {}),
      ...('dueDate' in body ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      ...('leadId' in body ? { leadId: body.leadId || null } : {}),
    },
    include: { lead: { select: { id: true, name: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getTask(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
