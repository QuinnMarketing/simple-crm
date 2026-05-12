import { runPendingQuoteFollowups } from '@/lib/automations'
import { NextResponse } from 'next/server'

// Call this endpoint on a schedule (e.g. daily) to fire pending quote follow-up automations.
// Protect it with CRON_SECRET in your env — pass as ?secret=... or Authorization: Bearer ...
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const provided = url.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await runPendingQuoteFollowups()
  return NextResponse.json({ ok: true, ...result })
}
