import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const accountFilter = getAccountFilter(session.user, undefined)
  const body = await req.json()

  const entry = await prisma.timeEntry.update({
    where: { id, ...accountFilter },
    data: {
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.durationMin !== undefined ? { durationMin: parseInt(body.durationMin) } : {}),
      ...(body.startedAt !== undefined ? { startedAt: new Date(body.startedAt) } : {}),
      ...(body.leadId !== undefined ? { leadId: body.leadId || null } : {}),
      ...(body.userId !== undefined ? { userId: body.userId || null } : {}),
      ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo?.trim() || null } : {}),
    },
    include: {
      lead: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(entry)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const accountFilter = getAccountFilter(session.user, undefined)

  await prisma.timeEntry.delete({ where: { id, ...accountFilter } })
  return NextResponse.json({ ok: true })
}
