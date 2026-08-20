import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// Server-to-server ingest for landing-page visit quality.
//
// The client never sends its own IP — the landing site resolves the real client
// address from its own edge headers and forwards it here with a shared secret,
// so a visitor cannot spoof or poison another IP's reputation. This route is
// excluded from the NextAuth middleware matcher; the secret is its only guard.

export const runtime = 'nodejs'

const MAX_DURATION_MS = 1000 * 60 * 30 // clamp absurd values from backgrounded tabs

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-ingest-key')
  const expected = process.env.VISIT_INGEST_KEY
  if (!expected) {
    return NextResponse.json({ error: 'Ingest not configured' }, { status: 503 })
  }
  if (!key || key !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    accountId,
    site,
    ip,
    path,
    durationMs,
    gclid,
    userAgent,
    referrer,
  } = (body ?? {}) as Record<string, unknown>

  if (typeof accountId !== 'string' || !accountId) {
    return NextResponse.json({ error: 'accountId required' }, { status: 400 })
  }
  if (typeof site !== 'string' || !site) {
    return NextResponse.json({ error: 'site required' }, { status: 400 })
  }
  if (typeof ip !== 'string' || !ip) {
    return NextResponse.json({ error: 'ip required' }, { status: 400 })
  }
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return NextResponse.json({ error: 'durationMs required' }, { status: 400 })
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  })
  if (!account) {
    return NextResponse.json({ error: 'Unknown account' }, { status: 404 })
  }

  await prisma.visitEvent.create({
    data: {
      accountId: account.id,
      site: site.slice(0, 120),
      ip: ip.slice(0, 64),
      path: typeof path === 'string' ? path.slice(0, 300) : '/',
      durationMs: Math.max(0, Math.min(MAX_DURATION_MS, Math.round(durationMs))),
      gclid: typeof gclid === 'string' && gclid ? gclid.slice(0, 200) : null,
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 400) : null,
      referrer: typeof referrer === 'string' ? referrer.slice(0, 400) : null,
    },
  })

  return NextResponse.json({ ok: true })
}
