import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { getCalendarConfig, listCalendarEvents } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountParam = searchParams.get('account')

  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json([])

  const config = await getCalendarConfig(accountId)
  if (!config) return NextResponse.json([])

  try {
    const events = await listCalendarEvents(config, from, to)
    // Hide events already synced into CRM appointments — they render as
    // real appointments, so showing the Google copy would duplicate them
    const linked = await prisma.appointment.findMany({
      where: { accountId, googleEventId: { not: null } },
      select: { googleEventId: true },
    })
    const linkedIds = new Set(linked.map(a => a.googleEventId))
    return NextResponse.json(events.filter(e => !linkedIds.has(e.id)))
  } catch (e) {
    console.error('GCal list error:', e)
    return NextResponse.json([])
  }
}
