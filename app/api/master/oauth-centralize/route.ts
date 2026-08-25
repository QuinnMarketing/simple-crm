import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function calendarClient() {
  return { id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '', secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '' }
}
function adsClient() {
  return {
    id: process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '',
    secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
  }
}

async function refresh(refreshToken: string, client: { id: string; secret: string }): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: client.id, client_secret: client.secret, grant_type: 'refresh_token' }),
    })
    const data = await res.json()
    return res.ok && data.access_token ? data.access_token : null
  } catch { return null }
}

// Confirm an access token can actually read a specific GA4 property — proves the
// agency identity has access before we point the account at it.
async function ga4Works(accessToken: string, propertyId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], metrics: [{ name: 'sessions' }], limit: 1 }),
    })
    return res.ok
  } catch { return false }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'master_admin') {
    return NextResponse.json({ error: 'master_admin only' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const dryRun = !!body.dryRun

  // 1. Find a healthy agency `google` token (new client) to centralise from.
  const googleRows = await prisma.accountIntegration.findMany({ where: { platform: 'google', enabled: true } })
  let agencyRefresh = ''
  let agencyAccess = ''
  let agencyEmail = ''
  for (const row of googleRows) {
    let cfg: { refreshToken?: string; email?: string } = {}
    try { cfg = JSON.parse(row.config) } catch { continue }
    if (!cfg.refreshToken) continue
    const access = await refresh(cfg.refreshToken, calendarClient())
    if (access) { agencyRefresh = cfg.refreshToken; agencyAccess = access; agencyEmail = cfg.email ?? ''; break }
  }
  if (!agencyRefresh) {
    return NextResponse.json({ error: 'No healthy agency `google` token found to centralise from. Connect one account via the unified Google flow first.' }, { status: 400 })
  }

  const fixed: { account: string; platform: string }[] = []
  const skipped: { account: string; platform: string; reason: string }[] = []

  // 2. Analytics — validate against each account's own propertyId, then repoint.
  const gaRows = await prisma.accountIntegration.findMany({ where: { platform: 'google_analytics' } })
  for (const row of gaRows) {
    const acct = await prisma.account.findUnique({ where: { id: row.accountId }, select: { name: true } })
    const name = acct?.name ?? row.accountId
    let cfg: Record<string, string> = {}
    try { cfg = JSON.parse(row.config) } catch { /* */ }
    // Already healthy? leave it.
    if (cfg.refreshToken && await refresh(cfg.refreshToken, calendarClient())) { continue }
    const propertyId = cfg.propertyId
    if (!propertyId) { skipped.push({ account: name, platform: 'google_analytics', reason: 'no GA4 property selected — needs reconnect + property pick' }); continue }
    if (!await ga4Works(agencyAccess, propertyId)) { skipped.push({ account: name, platform: 'google_analytics', reason: `agency identity (${agencyEmail}) cannot read property ${propertyId}` }); continue }
    if (!dryRun) {
      await prisma.accountIntegration.update({
        where: { accountId_platform: { accountId: row.accountId, platform: 'google_analytics' } },
        data: { config: JSON.stringify({ ...cfg, refreshToken: agencyRefresh, email: agencyEmail || cfg.email }), enabled: true },
      })
    }
    fixed.push({ account: name, platform: 'google_analytics' })
  }

  // 3. Ads — repoint token to the agency identity and drop the deleted OAuth
  // client so it uses the current env client. Data stays pinned by customerId.
  const adsRows = await prisma.accountIntegration.findMany({ where: { platform: 'google_ads' } })
  for (const row of adsRows) {
    const acct = await prisma.account.findUnique({ where: { id: row.accountId }, select: { name: true } })
    const name = acct?.name ?? row.accountId
    let cfg: Record<string, string> = {}
    try { cfg = JSON.parse(row.config) } catch { /* */ }
    if (!cfg.customerId || !cfg.developerToken) { skipped.push({ account: name, platform: 'google_ads', reason: 'missing customerId/developerToken' }); continue }
    // Already healthy under its stored client?
    const storedClient = cfg.clientId && cfg.clientSecret ? { id: cfg.clientId, secret: cfg.clientSecret } : adsClient()
    if (cfg.refreshToken && await refresh(cfg.refreshToken, storedClient)) { continue }
    // Validate the agency token refreshes under the current ads client.
    if (!await refresh(agencyRefresh, adsClient())) { skipped.push({ account: name, platform: 'google_ads', reason: 'agency token will not refresh under ads client' }); continue }
    if (!dryRun) {
      const { clientId, clientSecret, ...rest } = cfg
      void clientId; void clientSecret
      await prisma.accountIntegration.update({
        where: { accountId_platform: { accountId: row.accountId, platform: 'google_ads' } },
        data: { config: JSON.stringify({ ...rest, refreshToken: agencyRefresh }), enabled: true },
      })
    }
    fixed.push({ account: name, platform: 'google_ads' })
  }

  return NextResponse.json({
    dryRun,
    agencyIdentity: agencyEmail,
    fixed,
    skipped,
    note: 'Business (GBP) and Calendar are intentionally excluded — GBP has per-location tokens that also need reconnecting, and Calendar writes to the connected identity\'s primary calendar.',
  })
}
