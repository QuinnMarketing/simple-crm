import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountId, enabled, title, description, slotDuration, bufferTime, timezone,
    availableHours, maxDaysAhead, minNoticeHours, cancellationHours, policyText } = body

  if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

  // Verify access
  const user = session.user
  if (user.role !== 'master_admin') {
    const ids = user.accountIds?.length ? user.accountIds : (user.accountId ? [user.accountId] : [])
    if (!ids.includes(accountId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = {
    enabled: Boolean(enabled),
    title: String(title ?? 'Book an Appointment').trim().slice(0, 120),
    description: description ? String(description).slice(0, 500) : null,
    slotDuration: Math.max(5, Math.min(480, parseInt(slotDuration) || 60)),
    bufferTime: Math.max(0, Math.min(120, parseInt(bufferTime) || 0)),
    timezone: String(timezone ?? 'Australia/Sydney'),
    availableHours: String(availableHours ?? '{}'),
    maxDaysAhead: Math.max(1, Math.min(365, parseInt(maxDaysAhead) || 60)),
    minNoticeHours: Math.max(0, Math.min(168, parseInt(minNoticeHours) || 24)),
    cancellationHours: Math.max(0, Math.min(336, parseInt(cancellationHours) ?? 24)),
    policyText: policyText ? String(policyText).slice(0, 1000) : null,
  }

  await prisma.bookingSettings.upsert({
    where: { accountId },
    create: { accountId, ...data },
    update: data,
  })

  return NextResponse.json({ success: true })
}
