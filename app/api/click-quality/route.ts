import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { assessIp, BOT_THRESHOLD_MS, type IpRow } from '@/lib/click-quality'
import { NextRequest, NextResponse } from 'next/server'

// Per-IP rollup of landing-page visit quality, with a shared-connection risk
// assessment so an IP is never blocked without the operator seeing why it might
// be carrying real customers.

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'ads')
  if (gate) return gate

  const { searchParams } = req.nextUrl
  const filter = getAccountFilter(session.user, searchParams.get('account'))
  const site = searchParams.get('site')
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days') ?? 30)))
  const paidOnly = searchParams.get('paidOnly') === '1'
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const events = await prisma.visitEvent.findMany({
    where: {
      ...filter,
      ...(site ? { site } : {}),
      ...(paidOnly ? { gclid: { not: null } } : {}),
      createdAt: { gte: since },
    },
    select: {
      ip: true, durationMs: true, userAgent: true, path: true,
      gclid: true, createdAt: true, site: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50000,
  })

  type Acc = {
    total: number; bot: number; human: number; paid: number
    uas: Set<string>; paths: Set<string>; first: Date; last: Date; sites: Set<string>
  }
  const byIp = new Map<string, Acc>()
  for (const e of events) {
    let a = byIp.get(e.ip)
    if (!a) {
      a = {
        total: 0, bot: 0, human: 0, paid: 0,
        uas: new Set(), paths: new Set(), sites: new Set(),
        first: e.createdAt, last: e.createdAt,
      }
      byIp.set(e.ip, a)
    }
    a.total++
    if (e.durationMs <= BOT_THRESHOLD_MS) a.bot++
    else a.human++
    if (e.gclid) a.paid++
    if (e.userAgent) a.uas.add(e.userAgent)
    a.paths.add(e.path)
    a.sites.add(e.site)
    if (e.createdAt < a.first) a.first = e.createdAt
    if (e.createdAt > a.last) a.last = e.createdAt
  }

  const blocked = await prisma.blockedIp.findMany({
    where: { ...filter },
    select: { ip: true, syncStatus: true, syncError: true, createdAt: true },
  })
  const blockedByIp = new Map(blocked.map(b => [b.ip, b]))

  const rows = Array.from(byIp.entries()).map(([ip, a]) => {
    const row: IpRow = {
      ip,
      totalVisits: a.total,
      botVisits: a.bot,
      humanVisits: a.human,
      distinctUserAgents: a.uas.size,
      distinctPaths: a.paths.size,
      paidVisits: a.paid,
      firstSeen: a.first.toISOString(),
      lastSeen: a.last.toISOString(),
    }
    const b = blockedByIp.get(ip)
    return {
      ...row,
      sites: Array.from(a.sites),
      assessment: assessIp(row),
      blocked: b ? { status: b.syncStatus, error: b.syncError, at: b.createdAt.toISOString() } : null,
    }
  })

  // Worst offenders first: most short sessions, then highest share of them.
  rows.sort((x, y) => y.botVisits - x.botVisits || y.assessment.botRatio - x.assessment.botRatio)

  const summary = {
    totalVisits: events.length,
    botVisits: events.filter(e => e.durationMs <= BOT_THRESHOLD_MS).length,
    distinctIps: rows.length,
    blockCandidates: rows.filter(r => r.assessment.safeToBlock && !r.blocked).length,
    sharedFlagged: rows.filter(r => r.assessment.sharedRisk === 'high').length,
    alreadyBlocked: rows.filter(r => r.blocked).length,
  }

  const sites = Array.from(new Set(events.map(e => e.site))).sort()

  return NextResponse.json({ rows, summary, sites, days, thresholdMs: BOT_THRESHOLD_MS })
}
