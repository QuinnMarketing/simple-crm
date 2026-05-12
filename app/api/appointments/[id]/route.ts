import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import {
  getCalendarConfig,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

async function getAppointment(id: string, userId: Parameters<typeof getAccountFilter>[0]) {
  return prisma.appointment.findFirst({
    where: { id, ...getAccountFilter(userId) },
    include: { lead: { select: { id: true, name: true } } },
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
    },
    include: { lead: { select: { id: true, name: true } } },
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

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json({ success: true })
}
