import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { assessIp, isPrivate, type IpRow } from '@/lib/click-quality'
import * as GoogleAds from '@/lib/ads/google-ads-api'
import { NextRequest, NextResponse } from 'next/server'

// Pushes an IP exclusion into Google Ads. Exclusions are campaign-level only,
// so the address is written to every enabled campaign on the connected account.

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'ads')
  if (gate) return gate

  const body = await req.json().catch(() => ({}))
  const { ip, accountId: accountParam, reason, force } = body as {
    ip?: string; accountId?: string; reason?: string; force?: boolean
  }
  if (!ip) return NextResponse.json({ error: 'ip required' }, { status: 400 })

  const filter = getAccountFilter(session.user, accountParam ?? null)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null
  if (!accountId) {
    return NextResponse.json({ error: 'Select a single account before blocking' }, { status: 400 })
  }

  if (isPrivate(ip)) {
    return NextResponse.json(
      { error: 'That is a private/internal address — blocking it would do nothing.' },
      { status: 400 }
    )
  }

  // Re-derive the assessment server-side; the client must not be able to talk
  // us past a shared-connection warning just by posting force from the console.
  const events = await prisma.visitEvent.findMany({
    where: { accountId, ip },
    select: { durationMs: true, userAgent: true, path: true, gclid: true, createdAt: true },
  })
  if (events.length === 0) {
    return NextResponse.json({ error: 'No visits recorded for that IP' }, { status: 404 })
  }
  const row: IpRow = {
    ip,
    totalVisits: events.length,
    botVisits: events.filter(e => e.durationMs <= 2000).length,
    humanVisits: events.filter(e => e.durationMs > 2000).length,
    distinctUserAgents: new Set(events.map(e => e.userAgent).filter(Boolean)).size,
    distinctPaths: new Set(events.map(e => e.path)).size,
    paidVisits: events.filter(e => e.gclid).length,
    firstSeen: events[0].createdAt.toISOString(),
    lastSeen: events[events.length - 1].createdAt.toISOString(),
  }
  const assessment = assessIp(row)
  if (assessment.sharedRisk === 'high' && !force) {
    return NextResponse.json({
      error: 'Blocked for safety — this IP looks shared.',
      assessment,
      needsForce: true,
    }, { status: 409 })
  }

  const platformAccount = await prisma.adPlatformAccount.findFirst({
    where: { accountId, platform: 'google_ads', enabled: true },
  })
  if (!platformAccount?.refreshToken) {
    return NextResponse.json(
      { error: 'No connected Google Ads account — connect one under Ad Manager first.' },
      { status: 400 }
    )
  }

  const record = await prisma.blockedIp.upsert({
    where: { accountId_ip: { accountId, ip } },
    create: {
      accountId, ip,
      reason: reason ?? assessment.recommendation,
      blockedBy: session.user.email ?? null,
      syncStatus: 'pending',
    },
    update: { syncStatus: 'pending', syncError: null },
  })

  try {
    const campaigns = await GoogleAds.listCampaigns(
      platformAccount.refreshToken,
      platformAccount.platformAccountId,
      platformAccount.developerToken ?? undefined,
      platformAccount.loginCustomerId ?? undefined
    )
    const targets = campaigns.filter(c => c.status === 'ENABLED').map(c => String(c.id))
    if (targets.length === 0) {
      throw new Error('No enabled campaigns on the connected Google Ads account')
    }

    const { added, failed } = await GoogleAds.addIpExclusions(
      platformAccount.refreshToken,
      platformAccount.platformAccountId,
      targets,
      ip,
      platformAccount.developerToken ?? undefined,
      platformAccount.loginCustomerId ?? undefined
    )

    // Google rejects a duplicate exclusion, which is a success for our purposes.
    const realFailures = failed.filter(f => !/already exists|DUPLICATE/i.test(f.error))
    const ok = realFailures.length === 0

    await prisma.blockedIp.update({
      where: { id: record.id },
      data: {
        syncStatus: ok ? 'synced' : 'failed',
        syncedAt: ok ? new Date() : null,
        syncError: ok ? null : realFailures.slice(0, 3).map(f => `${f.campaignId}: ${f.error}`).join('; '),
      },
    })

    return NextResponse.json({
      ok,
      ip,
      campaignsTargeted: targets.length,
      campaignsAdded: added,
      failures: realFailures.length,
      assessment,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    await prisma.blockedIp.update({
      where: { id: record.id },
      data: { syncStatus: 'failed', syncError: message.slice(0, 500) },
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
