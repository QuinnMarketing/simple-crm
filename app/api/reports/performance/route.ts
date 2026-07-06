import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountParam = searchParams.get('account') ?? undefined
  const accountFilter = getAccountFilter(session.user, accountParam)

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  }
  const accountIdFilter = accountFilter.accountId ? { accountId: accountFilter.accountId } : {}

  const [apptLogs, wonLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: 'appointment.created', ...accountIdFilter, createdAt: dateFilter },
      select: { userEmail: true },
    }),
    prisma.auditLog.findMany({
      where: { action: 'lead.updated', ...accountIdFilter, createdAt: dateFilter },
      select: { userEmail: true, entityId: true, changes: true },
    }),
  ])

  // CSR leaderboard — appointments booked
  const apptMap = new Map<string, number>()
  for (const log of apptLogs) {
    const user = log.userEmail ?? 'Unknown'
    apptMap.set(user, (apptMap.get(user) ?? 0) + 1)
  }
  // Salesperson leaderboard — deals closed (status → won)
  const wonEntries: { email: string; leadId: string }[] = []
  for (const log of wonLogs) {
    let changes: Record<string, unknown> | null = null
    try { changes = log.changes ? JSON.parse(log.changes) : null } catch { /* ignore */ }
    const statusChange = changes?.status as [string, string] | undefined
    if (Array.isArray(statusChange) && statusChange[1] === 'won') {
      wonEntries.push({ email: log.userEmail ?? 'Unknown', leadId: log.entityId })
    }
  }

  const uniqueLeadIds = [...new Set(wonEntries.map(e => e.leadId))]
  const leads = uniqueLeadIds.length > 0
    ? await prisma.lead.findMany({
        where: { id: { in: uniqueLeadIds }, ...accountFilter },
        select: { id: true, value: true },
      })
    : []
  const leadValueMap = new Map(leads.map(l => [l.id, l.value ?? 0]))

  const wonMap = new Map<string, { count: number; value: number }>()
  for (const entry of wonEntries) {
    const existing = wonMap.get(entry.email) ?? { count: 0, value: 0 }
    existing.count++
    existing.value += leadValueMap.get(entry.leadId) ?? 0
    wonMap.set(entry.email, existing)
  }

  // Look up names for all users referenced
  const allEmails = [...new Set([...apptMap.keys(), ...wonMap.keys()])].filter(e => e !== 'Unknown')
  const users = allEmails.length > 0
    ? await prisma.user.findMany({ where: { email: { in: allEmails } }, select: { email: true, name: true } })
    : []
  const nameMap = new Map(users.map(u => [u.email, u.name ?? u.email]))

  const topCSRs = [...apptMap.entries()]
    .map(([email, count]) => ({ name: nameMap.get(email) ?? email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topSalespeople = [...wonMap.entries()]
    .map(([email, { count, value }]) => ({ name: nameMap.get(email) ?? email, count, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return NextResponse.json({ topCSRs, topSalespeople })
}
