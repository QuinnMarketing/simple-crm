import { prisma } from '@/lib/prisma'
import { ingestMetaLead } from '@/lib/meta-lead-ingest'
import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

// ── Meta webhook URL verification handshake (one-time, from the App dashboard) ──
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expected = process.env.META_LEADGEN_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN
  if (mode === 'subscribe' && token && expected && token === expected) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.FACEBOOK_APP_SECRET
  if (!secret || !signatureHeader) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

type LeadgenChange = { leadgen_id?: string; page_id?: string; form_id?: string; ad_id?: string; created_time?: number }

// pageId → accountId, built from every account's mapped Meta pages.
async function pageIndex(): Promise<Map<string, string>> {
  const integrations = await prisma.accountIntegration.findMany({
    where: { platform: 'meta', enabled: true },
    select: { accountId: true, config: true },
  })
  const map = new Map<string, string>()
  for (const i of integrations) {
    try {
      const cfg = JSON.parse(i.config) as { pages?: { id?: string }[] }
      for (const p of cfg.pages ?? []) if (p.id) map.set(p.id, i.accountId)
    } catch { /* skip malformed config */ }
  }
  return map
}

async function processLead(change: LeadgenChange, idx: Map<string, string>): Promise<'created' | 'duplicate' | 'unmapped' | 'error'> {
  const leadgenId = change.leadgen_id
  const pageId = change.page_id
  if (!leadgenId || !pageId) return 'error'

  const accountId = idx.get(pageId)
  if (!accountId) return 'unmapped' // page not mapped to any account — nothing to retry

  return ingestMetaLead(accountId, { leadgenId, pageId, formId: change.form_id })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifySignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { object?: string; entry?: { id?: string; changes?: { field?: string; value?: LeadgenChange }[] }[] }
  try { payload = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  // Gather every leadgen change across all entries.
  const changes: LeadgenChange[] = []
  for (const entry of payload.entry ?? []) {
    for (const c of entry.changes ?? []) {
      if (c.field === 'leadgen' && c.value?.leadgen_id) {
        changes.push({ ...c.value, page_id: c.value.page_id ?? entry.id })
      }
    }
  }
  if (changes.length === 0) return NextResponse.json({ ok: true, note: 'no leadgen changes' })

  const idx = await pageIndex()
  let transientFailure = false
  const results: Record<string, number> = { created: 0, duplicate: 0, unmapped: 0, error: 0 }
  for (const change of changes) {
    try {
      const r = await processLead(change, idx)
      results[r] = (results[r] ?? 0) + 1
      if (r === 'error') transientFailure = true
    } catch {
      transientFailure = true
      results.error++
    }
  }

  // Non-200 makes Meta redeliver; only for transient errors so we don't loop on
  // permanently-unmappable pages.
  if (transientFailure) return NextResponse.json({ ok: false, results }, { status: 500 })
  return NextResponse.json({ ok: true, results })
}
