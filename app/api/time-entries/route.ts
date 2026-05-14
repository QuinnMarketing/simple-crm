import { auth } from '@/auth'
import { logAudit, getIp } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { after, NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountFilter = getAccountFilter(session.user, undefined)
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('leadId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where = {
    ...accountFilter,
    ...(leadId ? { leadId } : {}),
    ...(from || to ? {
      startedAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    } : {}),
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    include: {
      lead: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountFilter = getAccountFilter(session.user, undefined)
  const accountId = (accountFilter as { accountId?: string }).accountId ?? session.user.accountId ?? null

  const body = await req.json()
  const { type, description, durationMin, startedAt, leadId, userId, assignedTo, latitude, longitude } = body

  if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })
  if (!durationMin || durationMin < 1) return NextResponse.json({ error: 'durationMin must be >= 1' }, { status: 400 })

  const entry = await prisma.timeEntry.create({
    data: {
      type,
      description: description?.trim() || null,
      durationMin: parseInt(durationMin),
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      assignedTo: assignedTo?.trim() || null,
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
      leadId: leadId || null,
      userId: userId || session.user.id || null,
      accountId,
    },
    include: {
      lead: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  after(() => logAudit({ accountId, userId: session.user.id, userEmail: session.user.email, action: 'time_entry.created', entityType: 'time_entry', entityId: entry.id, entityLabel: `${entry.type} — ${entry.durationMin}m`, ipAddress: getIp(req as Request) }))
  return NextResponse.json(entry, { status: 201 })
}
