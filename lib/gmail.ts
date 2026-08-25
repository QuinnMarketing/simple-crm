import { prisma } from './prisma'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API_BASE = 'https://gmail.googleapis.com/gmail/v1'

// Reuses the same Google Cloud OAuth client as Calendar unless a dedicated
// one is set — scopes are requested per auth URL, not tied to the client,
// so this only needs the Gmail API enabled + gmail.readonly added to the
// OAuth consent screen on that same project, not a whole new app.
function clientId() {
  return process.env.GOOGLE_GMAIL_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || ''
}
function clientSecret() {
  return process.env.GOOGLE_GMAIL_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ''
}
function redirectUri() {
  return `${process.env.NEXTAUTH_URL}/api/integrations/gmail/callback`
}

export interface GmailConfig {
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
    // readonly only — the CRM already has its own send path (SMTP via
    // EmailModal); we don't need to send through the user's personal Gmail
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'select_account consent',
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
    }),
  })
  if (!res.ok) throw new Error(`Gmail token exchange failed: ${await res.text()}`)
  const data = await res.json()
  if (!data.refresh_token) throw new Error('No refresh token returned — try disconnecting and reconnecting')

  let email: string | undefined
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    if (infoRes.ok) email = (await infoRes.json()).email
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
    }),
  })
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`)
  return (await res.json()).access_token
}

export interface NormalizedMessage {
  externalId: string
  fromEmail: string
  fromName?: string
  toEmail?: string
  subject?: string
  snippet: string
  sentAt: Date
}

function parseAddressHeader(value: string): { name?: string; email?: string } {
  const match = value.match(/^(.*?)\s*<(.+)>$/)
  if (match) return { name: match[1].trim().replace(/^"|"$/g, '') || undefined, email: match[2].trim() }
  return { email: value.trim() }
}

/** Lists inbox messages received after `sinceEpochSeconds`, newest first, capped at 50 per poll. */
export async function listRecentInboxMessages(config: GmailConfig, sinceEpochSeconds: number): Promise<NormalizedMessage[]> {
  const token = await getAccessToken(config.refreshToken)
  const headers = { Authorization: `Bearer ${token}` }

  const listRes = await fetch(
    `${API_BASE}/users/me/messages?${new URLSearchParams({ q: `in:inbox after:${sinceEpochSeconds}`, maxResults: '50' })}`,
    { headers },
  )
  if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`)
  const listData = await listRes.json()
  const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id)

  const messages: NormalizedMessage[] = []
  for (const id of ids) {
    const msgRes = await fetch(
      `${API_BASE}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
      { headers },
    )
    if (!msgRes.ok) continue
    const msg = await msgRes.json()
    const getHeader = (name: string) => msg.payload?.headers?.find((h: { name: string }) => h.name === name)?.value as string | undefined

    const from = getHeader('From')
    if (!from) continue
    const { name: fromName, email: fromEmail } = parseAddressHeader(from)
    if (!fromEmail) continue

    messages.push({
      externalId: msg.id,
      fromEmail,
      fromName,
      toEmail: parseAddressHeader(getHeader('To') ?? '').email,
      subject: getHeader('Subject'),
      snippet: msg.snippet ?? '',
      sentAt: new Date(Number(msg.internalDate)),
    })
  }
  return messages
}

export async function getGmailConfig(accountId: string): Promise<GmailConfig | null> {
  const row = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'gmail' } },
  })
  if (!row?.enabled) return null
  try {
    const cfg = JSON.parse(row.config) as Partial<GmailConfig>
    return cfg.refreshToken ? (cfg as GmailConfig) : null
  } catch {
    return null
  }
}
