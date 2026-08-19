import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { runAutomations } from '@/lib/automations'
import { sendPushToAccount } from '@/lib/push'
import { appendLeadToSheet } from '@/lib/google-sheets'
import { syncLeadToTrackingSheet } from '@/lib/lead-tracking-sheet'
import { createHmac, timingSafeEqual } from 'crypto'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

const GRAPH = 'https://graph.facebook.com/v20.0'

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

type MetaPage = { id: string; name?: string; accessToken?: string }
type LeadgenChange = { leadgen_id?: string; page_id?: string; form_id?: string; ad_id?: string; created_time?: number }

// Resolve which CRM account owns a given Facebook page, and the page token we
// need to read the lead. Built once per request from the connected Meta accounts.
async function pageIndex(): Promise<Map<string, { accountId: string; pageToken: string; pageName: string }>> {
  const integrations = await prisma.accountIntegration.findMany({
    where: { platform: 'meta', enabled: true },
    select: { accountId: true, config: true },
  })
  const map = new Map<string, { accountId: string; pageToken: string; pageName: string }>()
  for (const i of integrations) {
    try {
      const cfg = JSON.parse(i.config) as { pages?: MetaPage[]; accessToken?: string }
      for (const p of cfg.pages ?? []) {
        if (p.id) map.set(p.id, { accountId: i.accountId, pageToken: p.accessToken || cfg.accessToken || '', pageName: p.name ?? '' })
      }
    } catch { /* skip malformed config */ }
  }
  return map
}

function fieldValue(fieldData: { name?: string; values?: string[] }[], ...names: string[]): string | null {
  for (const n of names) {
    const f = fieldData.find((x) => (x.name ?? '').toLowerCase() === n)
    const v = f?.values?.[0]?.trim()
    if (v) return v
  }
  return null
}

async function processLead(change: LeadgenChange, idx: Awaited<ReturnType<typeof pageIndex>>): Promise<'created' | 'duplicate' | 'unmapped' | 'error'> {
  const leadgenId = change.leadgen_id
  const pageId = change.page_id
  if (!leadgenId || !pageId) return 'error'

  const owner = idx.get(pageId)
  if (!owner || !owner.pageToken) return 'unmapped' // page not connected to any account — nothing to retry
  const { accountId, pageToken } = owner

  // Idempotency — Meta re-delivers; skip if we've already ingested this leadgen_id.
  const existing = await prisma.lead.findFirst({
    where: { accountId, formData: { contains: leadgenId } },
    select: { id: true },
  })
  if (existing) return 'duplicate'

  // Pull the actual answers from the Graph API using the page token.
  const url = `${GRAPH}/${leadgenId}?fields=field_data,created_time,ad_id,ad_name,adset_name,campaign_name,form_id&access_token=${pageToken}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(data?.error?.message ?? `Graph error ${res.status}`)

  const fieldData: { name?: string; values?: string[] }[] = Array.isArray(data.field_data) ? data.field_data : []

  const first = fieldValue(fieldData, 'first_name')
  const last = fieldValue(fieldData, 'last_name')
  const name =
    fieldValue(fieldData, 'full_name', 'name') ||
    [first, last].filter(Boolean).join(' ').trim() ||
    'Facebook Lead'
  const email = fieldValue(fieldData, 'email')
  const phone = fieldValue(fieldData, 'phone_number', 'phone', 'work_phone_number')

  // Everything the form captured, preserved verbatim + the Meta identifiers.
  const answers: Record<string, string> = {}
  for (const f of fieldData) if (f.name) answers[f.name] = (f.values ?? []).join(', ')
  const formPayload = {
    ...answers,
    _leadgenId: leadgenId,
    _pageId: pageId,
    _formId: change.form_id ?? data.form_id ?? '',
    _adId: change.ad_id ?? data.ad_id ?? '',
    _campaign: data.campaign_name ?? '',
  }

  // A readable notes block for anything beyond name/email/phone.
  const extra = fieldData
    .filter((f) => !['full_name', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'phone'].includes((f.name ?? '').toLowerCase()))
    .map((f) => `${f.name}: ${(f.values ?? []).join(', ')}`)
  const notesParts = [
    data.campaign_name ? `Campaign: ${data.campaign_name}` : '',
    data.ad_name ? `Ad: ${data.ad_name}` : '',
    ...extra,
  ].filter(Boolean)

  const lead = await prisma.lead.create({
    data: {
      name,
      email: email ?? null,
      phone: phone ?? null,
      source: 'facebook',
      status: 'new',
      service: fieldValue(fieldData, 'service', 'what_service_are_you_interested_in') ?? null,
      notes: notesParts.length ? notesParts.join('\n') : 'Meta Instant Form lead',
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: data.campaign_name ?? null,
      formData: JSON.stringify(formPayload),
      accountId,
    },
  })

  after(() => appendLeadToSheet(lead))
  after(() => syncLeadToTrackingSheet(accountId, lead))
  after(() => runAutomations('lead_created', lead))
  after(() => logAudit({ accountId, action: 'lead.created', entityType: 'lead', entityId: lead.id, entityLabel: lead.name }))
  after(() => sendPushToAccount(accountId, {
    title: `New Lead: ${lead.name}`,
    body: [lead.service, 'Facebook Instant Form'].filter(Boolean).join(' · '),
    url: `/leads/${lead.id}`,
  }))

  return 'created'
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
    } catch {
      // Graph fetch/DB hiccup — let Meta retry by signalling non-200 below.
      transientFailure = true
      results.error++
    }
  }

  // Non-200 makes Meta redeliver; only do that for transient errors so we don't
  // loop forever on permanently-unmappable pages.
  if (transientFailure) return NextResponse.json({ ok: false, results }, { status: 500 })
  return NextResponse.json({ ok: true, results })
}
