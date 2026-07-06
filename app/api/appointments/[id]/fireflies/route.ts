import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { addBotToMeeting } from '@/lib/fireflies'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

function looksLikeMeetingUrl(value: string | null): value is string {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const appointment = await prisma.appointment.findFirst({ where: { id, ...filter } })
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!looksLikeMeetingUrl(appointment.location)) {
    return NextResponse.json({ error: 'This appointment has no meeting link in its Location field' }, { status: 400 })
  }
  if (appointment.firefliesStatus === 'requested') {
    return NextResponse.json({ error: 'A recording has already been requested for this appointment' }, { status: 400 })
  }

  const ref = randomBytes(6).toString('hex')
  const title = `${appointment.title} [ref:${ref}]`.slice(0, 256)

  try {
    await addBotToMeeting(appointment.location, title)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to start recording' }, { status: 502 })
  }

  await prisma.appointment.update({
    where: { id },
    data: { firefliesRef: ref, firefliesStatus: 'requested' },
  })

  return NextResponse.json({ status: 'requested' })
}
