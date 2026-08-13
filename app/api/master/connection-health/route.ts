import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

// Google OAuth platforms whose stored refresh token can be validated by a live
// refresh. All of these were minted by the shared Google OAuth client, so if the
// client changes their tokens go stale with `unauthorized_client`.
const GOOGLE_OAUTH = new Set([
  'google', 'google_analytics', 'google_business', 'google_calendar', 'gmail', 'sheets', 'google_ads',
])

// Platforms that store connection detail but not a refreshable OAuth token, so
// there's nothing to live-test — shown for completeness, never flagged.
const INFO_ONLY: Record<string, string> = {
  google_ga4: 'Measurement Protocol (no OAuth token)',
  google_search_console: 'Uses the Google account token',
  facebook: 'Long-lived access token (not refresh-tested)',
  meta: 'Long-lived access token (not refresh-tested)',
  linkedin: 'LinkedIn access token (not refresh-tested)',
  servicem8: 'API key',
  email_smtp: 'SMTP credentials',
}

type Status = 'healthy' | 'needs_reconnect' | 'error' | 'no_token' | 'not_configured' | 'info'

type IntegrationHealth = {
  platform: string
  enabled: boolean
  status: Status
  detail: string
  email?: string
}

function googleClient(platform: string, cfg: Record<string, string>): { id: string; secret: string } {
  // Google Ads stores its own OAuth client per account; the rest share the base client.
  if (platform === 'google_ads' && cfg.clientId && cfg.clientSecret) {
    return { id: cfg.clientId, secret: cfg.clientSecret }
  }
  if (platform === 'sheets') {
    return {
      id: process.env.GOOGLE_SHEETS_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
      secret: process.env.GOOGLE_SHEETS_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
    }
  }
  return {
    id: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
    secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
  }
}

async function testRefresh(url: string, body: Record<string, string>): Promise<{ status: Status; detail: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...body, grant_type: 'refresh_token' }),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.access_token) return { status: 'healthy', detail: 'Token refresh succeeded' }
    const err = String(data.error ?? `HTTP ${res.status}`)
    // unauthorized_client / invalid_grant = the token no longer matches the OAuth client → reconnect
    if (err === 'unauthorized_client' || err === 'invalid_grant' || err === 'invalid_client') {
      return { status: 'needs_reconnect', detail: `${err} — token was issued by a different OAuth client` }
    }
    return { status: 'error', detail: String(data.error_description ?? err) }
  } catch (e) {
    return { status: 'error', detail: e instanceof Error && e.name === 'AbortError' ? 'Timed out' : String(e) }
  } finally {
    clearTimeout(t)
  }
}

async function checkIntegration(platform: string, cfgRaw: string, enabled: boolean): Promise<IntegrationHealth> {
  let cfg: Record<string, string> = {}
  try { cfg = JSON.parse(cfgRaw) } catch { /* leave empty */ }
  const base: IntegrationHealth = { platform, enabled, status: 'info', detail: '', email: cfg.email }

  if (INFO_ONLY[platform] && !GOOGLE_OAUTH.has(platform)) {
    return { ...base, status: 'info', detail: INFO_ONLY[platform] }
  }

  if (platform === 'outlook') {
    if (!cfg.refreshToken) return { ...base, status: 'no_token', detail: 'No refresh token stored' }
    if (!process.env.MICROSOFT_CLIENT_ID) return { ...base, status: 'not_configured', detail: 'MICROSOFT_CLIENT_ID not set' }
    const r = await testRefresh(MS_TOKEN_URL, {
      refresh_token: cfg.refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
    })
    return { ...base, ...r }
  }

  if (GOOGLE_OAUTH.has(platform)) {
    if (!cfg.refreshToken) {
      // e.g. google_analytics that only stores a propertyId — token lives elsewhere
      return { ...base, status: 'info', detail: 'No OAuth token here (configured via another connection)' }
    }
    const client = googleClient(platform, cfg)
    if (!client.id || !client.secret) return { ...base, status: 'not_configured', detail: 'OAuth client env not set' }
    const r = await testRefresh(GOOGLE_TOKEN_URL, {
      refresh_token: cfg.refreshToken,
      client_id: client.id,
      client_secret: client.secret,
    })
    return { ...base, ...r }
  }

  return { ...base, status: 'info', detail: 'Not health-checked' }
}

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'master_admin') {
    return NextResponse.json({ error: 'master_admin only' }, { status: 403 })
  }

  const accounts = await prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
  const integrations = await prisma.accountIntegration.findMany({
    select: { accountId: true, platform: true, config: true, enabled: true },
  })

  const byAccount = new Map<string, typeof integrations>()
  for (const i of integrations) {
    const list = byAccount.get(i.accountId) ?? []
    list.push(i)
    byAccount.set(i.accountId, list)
  }

  // Check every integration in parallel (bounded by fetch's own concurrency).
  const results = await Promise.all(
    accounts.map(async (acc) => {
      const list = byAccount.get(acc.id) ?? []
      const checks = await Promise.all(list.map((i) => checkIntegration(i.platform, i.config, i.enabled)))
      return { accountId: acc.id, accountName: acc.name, integrations: checks }
    })
  )

  // Only surface accounts that actually have connections.
  const accountsWithConns = results.filter((r) => r.integrations.length > 0)

  const summary = { healthy: 0, needs_reconnect: 0, error: 0, not_configured: 0, other: 0 }
  for (const r of accountsWithConns) {
    for (const i of r.integrations) {
      if (i.status === 'healthy') summary.healthy++
      else if (i.status === 'needs_reconnect') summary.needs_reconnect++
      else if (i.status === 'error') summary.error++
      else if (i.status === 'not_configured') summary.not_configured++
      else summary.other++
    }
  }

  return NextResponse.json({ checkedAt: new Date().toISOString(), summary, accounts: accountsWithConns })
}
