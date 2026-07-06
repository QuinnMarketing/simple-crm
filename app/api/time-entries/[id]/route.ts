import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextResponse } from 'next/server'

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
      ...(body.projectId !== undefined ? { projectId: body.projectId || null } : {}),
      ...(body.userId !== undefined ? { userId: body.userId || null } : {}),
      ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo?.trim() || null } : {}),
      ...(body.hourlyRate !== undefined ? { hourlyRate: body.hourlyRate != null ? parseFloat(body.hourlyRate) : null } : {}),
    },
    include: {
      lead: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  })

  after(() => logAudit({ accountId: entry.accountId, userId: session.user.id, userEmail: session.user.email, action: 'time_entry.updated', entityType: 'time_entry', entityId: entry.id, entityLabel: `${entry.type} — ${entry.durationMin}m`, ipAddress: getIp(req) }))
  return NextResponse.json(entry)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const accountFilter = getAccountFilter(session.user, undefined)
  const existing = await prisma.timeEntry.findFirst({ where: { id, ...accountFilter } })

  await prisma.timeEntry.delete({ where: { id, ...accountFilter } })
  after(() => logAudit({ accountId: existing?.accountId, userId: session.user.id, userEmail: session.user.email, action: 'time_entry.deleted', entityType: 'time_entry', entityId: id, entityLabel: existing ? `${existing.type} — ${existing.durationMin}m` : id, ipAddress: getIp(req) }))
  return NextResponse.json({ ok: true })
}
