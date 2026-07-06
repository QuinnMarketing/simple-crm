import { prisma } from './prisma'
import type { NormalizedMessage } from './gmail'

// "common" endpoint accepts both personal Microsoft accounts and work/school
// (Azure AD) accounts — the typical mix for a small trades business
const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

const SCOPES = 'offline_access Mail.Read User.Read' // readonly — CRM sends via its own SMTP path, not through the user's mailbox

function clientId() { return process.env.MICROSOFT_CLIENT_ID || '' }
function clientSecret() { return process.env.MICROSOFT_CLIENT_SECRET || '' }
function redirectUri() { return `${process.env.NEXTAUTH_URL}/api/integrations/outlook/callback` }

export interface OutlookConfig {
  refreshToken: string
  email?: string
  lastSyncedAt?: string // ISO — sync cursor
}

export function getAuthUrl(accountId: string): string {
  const state = Buffer.from(accountId).toString('base64url')
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    response_mode: 'query',
    state,
  })
  return `${AUTH_URL}?${params}`
}

export async function exchangeCode(code: string): Promise<{ refreshToken: string; email?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      scope: SCOPES,
    }),
  })
  if (!res.ok) throw new Error(`Outlook token exchange failed: ${await res.text()}`)
  const data = await res.json()
  if (!data.refresh_token) throw new Error('No refresh token returned — try disconnecting and reconnecting')

  let email: string | undefined
  try {
    const meRes = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${data.access_token}` } })
    if (meRes.ok) {
      const me = await meRes.json()
      email = me.mail ?? me.userPrincipalName
    }
  } catch { /* best-effort */ }

  return { refreshToken: data.refresh_token, email }
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
      scope: SCOPES,
    }),
  })
  if (!res.ok) throw new Error(`Outlook token refresh failed: ${await res.text()}`)
  return (await res.json()).access_token
}

/** Lists inbox messages received after `sinceIso`, capped at 50 per poll. */
export async function listRecentInboxMessages(config: OutlookConfig, sinceIso: string): Promise<NormalizedMessage[]> {
  const token = await getAccessToken(config.refreshToken)
  const params = new URLSearchParams({
    '$filter': `receivedDateTime ge ${sinceIso}`,
    '$select': 'id,subject,from,toRecipients,receivedDateTime,bodyPreview',
    '$top': '50',
    '$orderby': 'receivedDateTime desc',
  })
  const res = await fetch(`${GRAPH_BASE}/me/mailFolders/inbox/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Outlook list failed: ${await res.text()}`)
  const data = await res.json()

  return (data.value ?? [])
    .filter((m: { from?: { emailAddress?: { address?: string } } }) => m.from?.emailAddress?.address)
    .map((m: {
      id: string
      subject?: string
      bodyPreview?: string
      receivedDateTime: string
      from: { emailAddress: { name?: string; address: string } }
      toRecipients?: { emailAddress: { address: string } }[]
    }): NormalizedMessage => ({
      externalId: m.id,
      fromEmail: m.from.emailAddress.address,
      fromName: m.from.emailAddress.name,
      toEmail: m.toRecipients?.[0]?.emailAddress?.address,
      subject: m.subject,
      snippet: m.bodyPreview ?? '',
      sentAt: new Date(m.receivedDateTime),
    }))
}

export async function getOutlookConfig(accountId: string): Promise<OutlookConfig | null> {
  const row = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'outlook' } },
  })
  if (!row?.enabled) return null
  try {
    const cfg = JSON.parse(row.config) as Partial<OutlookConfig>
    return cfg.refreshToken ? (cfg as OutlookConfig) : null
  } catch {
    return null
  }
}
