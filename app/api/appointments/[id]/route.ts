import { auth } from '@/auth'
import { logAudit, auditDiff, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import {
  getCalendarConfig,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/google-calendar'
import { after, NextRequest, NextResponse } from 'next/server'

async function getAppointment(id: string, userId: Parameters<typeof getAccountFilter>[0]) {
  return prisma.appointment.findFirst({
    where: { id, ...getAccountFilter(userId) },
    include: {
      lead: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const appt = await getAppointment(id, session.user)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(appt)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const existing = await getAppointment(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      ...('title' in body ? { title: body.title } : {}),
      ...('description' in body ? { description: body.description || null } : {}),
      ...('startTime' in body ? { startTime: new Date(body.startTime) } : {}),
      ...('endTime' in body ? { endTime: new Date(body.endTime) } : {}),
      ...('allDay' in body ? { allDay: !!body.allDay } : {}),
      ...('location' in body ? { location: body.location || null } : {}),
      ...('leadId' in body ? { leadId: body.leadId || null } : {}),
      ...('userId' in body ? { userId: body.userId || null } : {}),
      ...('status' in body && ['scheduled', 'completed', 'cancelled', 'no_show'].includes(body.status) ? { status: body.status } : {}),
    },
    include: {
      lead: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })

  if (updated.accountId) {
    const config = await getCalendarConfig(updated.accountId)
    if (config) {
      try {
        const eventData = {
          summary: `[CRM] ${updated.title}`,
          description: updated.description ?? undefined,
          location: updated.location ?? undefined,
          allDay: updated.allDay,
          startIso: updated.startTime.toISOString(),
          endIso: updated.endTime.toISOString(),
        }
        if (updated.googleEventId) {
          await updateCalendarEvent(config, updated.googleEventId, eventData)
        } else {
          const googleEventId = await createCalendarEvent(config, eventData)
          await prisma.appointment.update({ where: { id }, data: { googleEventId } })
        }
      } catch (e) {
        console.error('GCal sync failed:', e)
      }
    }
  }

  after(() => logAudit({ accountId: updated.accountId, userId: session.user.id, userEmail: session.user.email, action: 'appointment.updated', entityType: 'appointment', entityId: updated.id, entityLabel: updated.title, changes: auditDiff(existing as Record<string, unknown>, updated as Record<string, unknown>), ipAddress: getIp(req) }))
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const existing = await getAppointment(id, session.user)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.googleEventId && existing.accountId) {
    const config = await getCalendarConfig(existing.accountId)
    if (config) {
      try { await deleteCalendarEvent(config, existing.googleEventId) } catch { /* best-effort */ }
    }
  }

  await prisma.appointment.delete({ where: { id } })
  after(() => logAudit({ accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email, action: 'appointment.deleted', entityType: 'appointment', entityId: id, entityLabel: existing.title, ipAddress: getIp(req) }))
  return NextResponse.json({ success: true })
}
