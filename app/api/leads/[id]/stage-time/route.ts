import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextResponse } from 'next/server'

export type StageEntry = {
  status: string
  enteredAt: string
  exitedAt: string | null
  durationMs: number
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const lead = await prisma.lead.findFirst({
    where: { id, ...filter },
    select: { id: true, status: true, createdAt: true },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: 'lead', entityId: id },
    orderBy: { createdAt: 'asc' },
    select: { changes: true, createdAt: true },
  })

  // Extract status transitions from audit logs
  type Transition = { from: string; to: string; at: Date }
  const transitions: Transition[] = []

  for (const log of auditLogs) {
    try {
      const changes = log.changes ? JSON.parse(log.changes) : null
      if (changes?.status) {
        const [from, to] = changes.status as [string, string]
        if (from !== to) transitions.push({ from, to, at: log.createdAt })
      }
    } catch { /* malformed JSON — skip */ }
  }

  const now = new Date()

  // Build stage timeline
  const entries: StageEntry[] = []

  if (transitions.length === 0) {
    // Lead has never changed status
    entries.push({
      status: lead.status,
      enteredAt: lead.createdAt.toISOString(),
      exitedAt: null,
      durationMs: now.getTime() - lead.createdAt.getTime(),
    })
  } else {
    // Initial status = 'from' of first transition
    let currentStatus = transitions[0].from
    let currentEnteredAt: Date = lead.createdAt

    for (const t of transitions) {
      entries.push({
        status: currentStatus,
        enteredAt: currentEnteredAt.toISOString(),
        exitedAt: t.at.toISOString(),
        durationMs: t.at.getTime() - currentEnteredAt.getTime(),
      })
      currentStatus = t.to
      currentEnteredAt = t.at
    }

    // Current (open) stage
    entries.push({
      status: currentStatus,
      enteredAt: currentEnteredAt.toISOString(),
      exitedAt: null,
      durationMs: now.getTime() - currentEnteredAt.getTime(),
    })
  }

  return NextResponse.json(entries)
}
