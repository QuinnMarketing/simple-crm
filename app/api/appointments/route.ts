import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { getCalendarConfig, createCalendarEvent } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const appointments = await prisma.appointment.findMany({
    where: {
      ...getAccountFilter(session.user),
      ...(from || to ? {
        startTime: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { startTime: 'asc' },
  })
  return NextResponse.json(appointments)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use accountId directly from the session — avoid casting the filter object
  const accountId = session.user.accountId ?? null

  const body = await req.json()
  const { title, description, startTime, endTime, allDay, location, leadId } = body

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ error: 'title, startTime and endTime are required' }, { status: 400 })
  }

  let appointment
  try {
    appointment = await prisma.appointment.create({
    data: {
      title,
      description: description || null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      allDay: !!allDay,
      location: location || null,
      leadId: leadId || null,
      accountId,
    },
      include: { lead: { select: { id: true, name: true } } },
    })
  } catch (e) {
    console.error('Appointment create error:', e)
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
  }

  if (accountId) {
    const config = await getCalendarConfig(accountId)
    if (config) {
      try {
        const googleEventId = await createCalendarEvent(config, {
          summary: `[CRM] ${title}`,
          description: description || undefined,
          location: location || undefined,
          allDay: !!allDay,
          startIso: new Date(startTime).toISOString(),
          endIso: new Date(endTime).toISOString(),
        })
        await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId } })
        return NextResponse.json({ ...appointment, googleEventId })
      } catch (e) {
        console.error('GCal push failed:', e)
      }
    }
  }

  return NextResponse.json(appointment)
}
