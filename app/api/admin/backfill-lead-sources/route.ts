import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { deriveLeadSource } from '@/lib/lead-source'
import { NextResponse } from 'next/server'

// One-time backfill: re-derive the source for leads stuck on "webhook"
// using their stored attribution data (gclid, fbclid, UTMs, page URL).
export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== 'master_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let updated = 0
  let unchanged = 0

  // Batch through in pages to stay well under bind-variable limits
  const BATCH = 5000
  let cursor: string | undefined

  for (;;) {
    const leads = await prisma.lead.findMany({
      where: { source: 'webhook' },
      select: { id: true, utmSource: true, utmMedium: true, gclid: true, fbclid: true, pageUrl: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (leads.length === 0) break
    cursor = leads[leads.length - 1].id

    // Group by derived source so each distinct value is one updateMany
    const bySource = new Map<string, string[]>()
    for (const lead of leads) {
      const derived = deriveLeadSource(lead)
      if (derived && derived !== 'webhook') {
        const ids = bySource.get(derived) ?? []
        ids.push(lead.id)
        bySource.set(derived, ids)
      } else {
        unchanged++
      }
    }

    for (const [source, ids] of bySource) {
      const res = await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { source } })
      updated += res.count
    }

    if (leads.length < BATCH) break
  }

  return NextResponse.json({ updated, unchanged })
}
