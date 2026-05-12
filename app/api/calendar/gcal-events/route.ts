import { auth } from '@/auth'
import { getCalendarConfig, listCalendarEvents } from '@/lib/google-calendar'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json([], { status: 200 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const config = await getCalendarConfig(accountId)
  if (!config) return NextResponse.json([], { status: 200 })

  try {
    const events = await listCalendarEvents(config, from, to)
    return NextResponse.json(events)
  } catch (e) {
    console.error('GCal list error:', e)
    return NextResponse.json([], { status: 200 })
  }
}
