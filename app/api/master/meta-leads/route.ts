import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { listSystemPages, subscribePageViaSystem, listRecentLeadIds, systemToken, getAppWebhookStatus, registerAppWebhook } from '@/lib/meta-leads'
import { ingestMetaLead } from '@/lib/meta-lead-ingest'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

type MetaConfig = { pages?: { id: string; name?: string }[]; viaSystemUser?: boolean; [k: string]: unknown }

async function metaByAccount() {
  const rows = await prisma.accountIntegration.findMany({ where: { platform: 'meta' } })
  const out = new Map<string, { row: typeof rows[number]; cfg: MetaConfig }>()
  for (const r of rows) {
    let cfg: MetaConfig = {}
    try { cfg = JSON.parse(r.config) } catch { /* ignore */ }
    out.set(r.accountId, { row: r, cfg })
  }
  return out
}

// GET — pages the System User manages, all accounts, and current page→account map.
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'master_admin') {
    return NextResponse.json({ error: 'master_admin only' }, { status: 403 })
  }
  if (!systemToken()) return NextResponse.json({ error: 'META_SYSTEM_USER_TOKEN not set', pages: [], accounts: [], mapping: {} }, { status: 200 })

  const [{ pages, error }, accounts, byAccount, appWebhook] = await Promise.all([
    listSystemPages(),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    metaByAccount(),
    getAppWebhookStatus(),
  ])

  // pageId → accountId, and pageId → subscription status if we've stored it.
  const mapping: Record<string, string> = {}
  for (const [accountId, { cfg }] of byAccount) {
    for (const p of cfg.pages ?? []) if (p.id) mapping[p.id] = accountId
  }

  return NextResponse.json({ pages, accounts, mapping, appWebhook, error: error ?? null })
}

// POST — assign a page to an account (or unassign with accountId=null).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'master_admin') {
    return NextResponse.json({ error: 'master_admin only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  // Register the App-level Page/leadgen webhook (the callback Meta POSTs to).
  // This is what makes leads arrive live, not just via backfill.
  if (body.action === 'register_webhook') {
    const r = await registerAppWebhook()
    return NextResponse.json(r, { status: r.ok ? 200 : 502 })
  }

  const pageId = String(body.pageId ?? '')
  const pageName = String(body.pageName ?? '')
  const accountId: string | null = body.accountId ? String(body.accountId) : null
  if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 })

  // Backfill: import a mapped page's existing leads (those that arrived before it
  // was subscribed) into its account.
  if (body.action === 'backfill') {
    const byAccountBf = await metaByAccount()
    let owner: string | null = null
    for (const [accId, { cfg }] of byAccountBf) {
      if ((cfg.pages ?? []).some((p) => p.id === pageId)) { owner = accId; break }
    }
    if (!owner) return NextResponse.json({ error: 'Page is not mapped to an account yet' }, { status: 400 })
    const { leads, error } = await listRecentLeadIds(pageId)
    if (error) return NextResponse.json({ error }, { status: 502 })
    const counts = { created: 0, duplicate: 0, error: 0 }
    for (const l of leads) {
      const r = await ingestMetaLead(owner, { leadgenId: l.leadgenId, pageId, formId: l.formId })
      counts[r]++
    }
    return NextResponse.json({ ok: true, accountId: owner, found: leads.length, ...counts })
  }

  const byAccount = await metaByAccount()

  // Remove this page from any account that currently holds it (a page maps to one).
  for (const [accId, { cfg }] of byAccount) {
    if (accId === accountId) continue
    if ((cfg.pages ?? []).some((p) => p.id === pageId)) {
      const pages = (cfg.pages ?? []).filter((p) => p.id !== pageId)
      await prisma.accountIntegration.update({
        where: { accountId_platform: { accountId: accId, platform: 'meta' } },
        data: { config: JSON.stringify({ ...cfg, pages }) },
      })
    }
  }

  if (!accountId) return NextResponse.json({ ok: true, unassigned: true })

  // Add the page to the target account's meta config (merge, don't clobber).
  const target = byAccount.get(accountId)
  const cfg: MetaConfig = target?.cfg ?? {}
  const pages = (cfg.pages ?? []).filter((p) => p.id !== pageId)
  pages.push({ id: pageId, name: pageName })
  const newCfg = JSON.stringify({ ...cfg, pages, viaSystemUser: true })
  await prisma.accountIntegration.upsert({
    where: { accountId_platform: { accountId, platform: 'meta' } },
    create: { accountId, platform: 'meta', config: newCfg, enabled: true },
    update: { config: newCfg, enabled: true },
  })

  // Arm lead delivery: subscribe the page to our leadgen webhook.
  const sub = await subscribePageViaSystem(pageId)
  return NextResponse.json({ ok: true, accountId, pageId, subscribed: sub.ok, subscribeError: sub.error ?? null })
}
