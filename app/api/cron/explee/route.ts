import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { fetchHotLeadsSince, expleeKey, type ExpleeHotLead } from '@/lib/explee'
import { logAudit } from '@/lib/audit'
import { runAutomations } from '@/lib/automations'
import { sendPushToAccount } from '@/lib/push'
import { appendLeadToSheet } from '@/lib/google-sheets'
import { syncLeadToTrackingSheet } from '@/lib/lead-tracking-sheet'
import { after, NextResponse } from 'next/server'

// Every ~10 min (vercel.json): pull new Explee hot leads into the configured
// account as leads (source = explee). Cursor (last became_hot_at) is persisted
// in the account's AccountIntegration('explee') config so we only ever fetch
// leads newer than the last one seen.
export const maxDuration = 60

// Authorized when called by Vercel's cron / CRON_SECRET, OR by the GitHub
// Actions scheduler carrying the dedicated EXPLEE_CRON_TOKEN (Vercel Hobby only
// allows daily crons, so the 10-min cadence comes from GitHub Actions).
function authorized(req: Request): boolean {
  if (isAuthorizedCron(req)) return true
  const token = process.env.EXPLEE_CRON_TOKEN
  if (!token) return false
  const url = new URL(req.url)
  return req.headers.get('x-explee-token') === token || url.searchParams.get('token') === token
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = process.env.EXPLEE_ACCOUNT_ID
  if (!accountId) return NextResponse.json({ error: 'EXPLEE_ACCOUNT_ID not set' }, { status: 500 })
  if (!expleeKey()) return NextResponse.json({ error: 'EXPLEE_API_KEY not set' }, { status: 500 })

  // Load cursor from the account's Explee integration row.
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'explee' } },
  })
  let cfg: { lastSince?: string; projectId?: string } = {}
  try { if (integration?.config) cfg = JSON.parse(integration.config) } catch { /* */ }
  const since = cfg.lastSince ?? null

  const { leads, error } = await fetchHotLeadsSince(since)
  if (error && leads.length === 0) return NextResponse.json({ ok: false, error, created: 0 }, { status: 502 })

  let created = 0
  let duplicate = 0
  let newestSeen = since ?? ''
  for (const lead of leads) {
    const hotAt = String(lead.became_hot_at ?? '')
    if (hotAt > newestSeen) newestSeen = hotAt
    try {
      const r = await ingestExpleeLead(accountId, lead)
      if (r === 'created') created++
      else duplicate++
    } catch { /* skip this one; cursor still advances past errors on next run */ }
  }

  // Persist the newest became_hot_at as the next cursor (upsert the row).
  const newCfg = JSON.stringify({ ...cfg, lastSince: newestSeen || cfg.lastSince || new Date().toISOString(), projectId: cfg.projectId ?? process.env.EXPLEE_PROJECT_ID ?? '31063' })
  await prisma.accountIntegration.upsert({
    where: { accountId_platform: { accountId, platform: 'explee' } },
    create: { accountId, platform: 'explee', config: newCfg, enabled: true },
    update: { config: newCfg },
  })

  return NextResponse.json({ ok: true, fetched: leads.length, created, duplicate, cursor: newestSeen || null, ...(error ? { warning: error } : {}) })
}

async function ingestExpleeLead(accountId: string, lead: ExpleeHotLead): Promise<'created' | 'duplicate'> {
  const email = lead.email?.trim() || null
  const personId = lead.person_id != null ? String(lead.person_id) : ''

  // Idempotency: skip if we've already ingested this Explee person, or the same
  // email already exists in this account.
  const existing = await prisma.lead.findFirst({
    where: {
      accountId,
      OR: [
        ...(personId ? [{ formData: { contains: `"_expleePersonId":"${personId}"` } }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    select: { id: true },
  })
  if (existing) return 'duplicate'

  const name = lead.name?.trim() || (email ? email.split('@')[0] : '') || 'Explee Lead'
  const roleCompany = [lead.job_title, lead.company_name].filter(Boolean).join(' @ ')
  const notes = [
    roleCompany,
    lead.company_domain ? `Domain: ${lead.company_domain}` : '',
    lead.country ? `Country: ${lead.country}` : '',
    lead.linkedin_url ? `LinkedIn: ${lead.linkedin_url}` : '',
    lead.why_hot ? `\nWhy hot (their reply):\n${lead.why_hot}` : '',
  ].filter(Boolean).join('\n')

  const formData = JSON.stringify({
    ...lead,
    _expleePersonId: personId,
    _expleeCampaignId: lead.campaign_id != null ? String(lead.campaign_id) : '',
    _becameHotAt: lead.became_hot_at ?? '',
  })

  const created = await prisma.lead.create({
    data: {
      name,
      email,
      phone: lead.phone?.trim() || null,
      source: 'explee',
      status: 'new',
      notes: notes || 'Explee hot lead',
      utmSource: 'explee',
      utmMedium: 'outbound',
      formData,
      accountId,
    },
  })

  after(() => appendLeadToSheet(created))
  after(() => syncLeadToTrackingSheet(accountId, created))
  after(() => runAutomations('lead_created', created))
  after(() => logAudit({ accountId, action: 'lead.created', entityType: 'lead', entityId: created.id, entityLabel: created.name }))
  after(() => sendPushToAccount(accountId, {
    title: `🔥 Hot lead: ${created.name}`,
    body: roleCompany || 'New Explee hot lead',
    url: `/leads/${created.id}`,
  }))

  return 'created'
}
