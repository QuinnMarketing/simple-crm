import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { NextResponse } from 'next/server'

// IP addresses are personal information under the Privacy Act, so raw visit
// rows are not kept indefinitely. 90 days is well past the point the data is
// useful for spotting repeat click abuse.
//
// BlockedIp rows are deliberately NOT purged: they are the operator's decisions,
// and the exclusion lives in Google Ads regardless.
const RETENTION_DAYS = Number(process.env.VISIT_RETENTION_DAYS ?? 90)

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const { count } = await prisma.visitEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  return NextResponse.json({ ok: true, deleted: count, retentionDays: RETENTION_DAYS, cutoff })
}
