import { prisma } from './prisma'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVIEWS_API = 'https://mybusiness.googleapis.com/v4'

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

export interface GBPReview {
  name: string           // accounts/.../locations/.../reviews/...
  reviewerName: string
  starRating: number     // 1-5
  comment: string | null
  createTime: string
  replyComment: string | null
  replyUpdateTime: string | null
}

// GBP API access is approved per Google Cloud project (new projects have
// ZERO quota until approved). These allow pointing GBP at a dedicated,
// already-approved project without touching the Calendar OAuth client.
export function gbpClientId() {
  return process.env.GOOGLE_GBP_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || ''
}
export function gbpClientSecret() {
  return process.env.GOOGLE_GBP_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ''
}

async function refreshAccessToken(refreshTokenStr: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshTokenStr,
      client_id: gbpClientId(),
      client_secret: gbpClientSecret(),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  return (await res.json()).access_token as string
}

// Get a fresh access token + location name from a SocialAccount row
async function getTokenForLocation(socialAccountId: string): Promise<{ token: string; locationName: string }> {
  const sa = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } })
  if (!sa) throw new Error('Social account not found')
  if (!sa.refreshToken) throw new Error('No refresh token — reconnect Google Business')
  const token = await refreshAccessToken(sa.refreshToken)
  await prisma.socialAccount.update({ where: { id: socialAccountId }, data: { accessToken: token } })
  return { token, locationName: sa.platformId }
}

// Get a fresh access token from the AccountIntegration credential store
export async function getTokenForAccount(accountId: string): Promise<string> {
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'google_business' } },
  })
  if (!integration?.enabled) throw new Error('Google Business not connected — go to Social to connect')
  let cfg: { refreshToken?: string }
  try { cfg = JSON.parse(integration.config) } catch { cfg = {} }
  if (!cfg.refreshToken) throw new Error('No refresh token stored — reconnect Google Business')
  return refreshAccessToken(cfg.refreshToken)
}

// Discover and upsert SocialAccount location rows from the master credential
const QUOTA_HELP =
  'Google Business Profile API quota exceeded. Note: Google Cloud projects have ZERO Business Profile quota until Google approves API access for that specific project (apply via the "Business Profile APIs" access request form) — if this happens on the very first attempt, the project needs approval, not a retry.'

async function fetchWithQuotaRetry(url: string, token: string): Promise<Response> {
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 429) {
    // One retry after backing off — covers transient per-minute spikes on approved projects
    await new Promise(r => setTimeout(r, 20_000))
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  }
  return res
}

export type GBPLocation = { id: string; title: string } // id = full path: accounts/{aid}/locations/{lid}

/**
 * Lists every location the connected Google account can manage, WITHOUT
 * saving anything — the UI shows these as a picker. IDs are the full
 * accounts/{aid}/locations/{lid} path: the v1 Business Information API
 * returns bare "locations/{lid}" names, but the v4 reviews API requires
 * the account prefix, so we join them here once and store only full paths.
 */
export async function listAvailableLocations(accountId: string): Promise<GBPLocation[]> {
  const token = await getTokenForAccount(accountId)

  const acctRes = await fetchWithQuotaRetry('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token)
  if (acctRes.status === 429) throw new Error(QUOTA_HELP)
  const acctData = await acctRes.json()
  if (!acctRes.ok || acctData.error) throw new Error(acctData.error?.message ?? `Account discovery failed (${acctRes.status})`)
  const gmbAccounts: Array<{ name: string }> = acctData.accounts ?? []
  if (gmbAccounts.length === 0) throw new Error('No Google Business accounts found')

  const locations: GBPLocation[] = []
  for (const acct of gmbAccounts.slice(0, 10)) {
    const locRes = await fetchWithQuotaRetry(`https://mybusinessbusinessinformation.googleapis.com/v1/${acct.name}/locations?readMask=name,title&pageSize=100`, token)
    if (locRes.status === 429) throw new Error(QUOTA_HELP)
    const locData = await locRes.json()
    for (const loc of locData.locations ?? []) {
      locations.push({ id: `${acct.name}/${loc.name}`, title: loc.title ?? loc.name })
    }
  }
  return locations
}

/** Replaces the account's connected GBP locations with the given selection. */
export async function connectLocations(accountId: string, selected: GBPLocation[]): Promise<number> {
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'google_business' } },
  })
  const cfg = integration ? (() => { try { return JSON.parse(integration.config) } catch { return {} } })() : {}
  const token = await getTokenForAccount(accountId)

  // The selection is the full desired state — remove anything not in it.
  // Also clears legacy rows stored with the bare "locations/{id}" format
  // that broke review syncing.
  await prisma.socialAccount.deleteMany({
    where: { accountId, platform: 'google_business', platformId: { notIn: selected.map(l => l.id) } },
  })

  for (const loc of selected) {
    await prisma.socialAccount.upsert({
      where: { accountId_platform_platformId: { accountId, platform: 'google_business', platformId: loc.id } },
      create: { accountId, platform: 'google_business', platformId: loc.id, name: loc.title, accessToken: token, refreshToken: cfg.refreshToken ?? null },
      update: { name: loc.title, accessToken: token, refreshToken: cfg.refreshToken ?? null },
    })
  }
  return selected.length
}

/** Auto-connects everything — used by review sync when nothing is connected yet. */
export async function discoverLocations(accountId: string): Promise<number> {
  const locations = await listAvailableLocations(accountId)
  return connectLocations(accountId, locations)
}

/**
 * Upgrades legacy rows stored with bare "locations/{lid}" platformIds to the
 * full accounts/{aid}/locations/{lid} path the v4 reviews API requires.
 * Rows that no longer match any accessible location are removed — their
 * format can never work, so they'd 404 on every sync forever.
 */
export async function migrateLegacyLocationIds(accountId: string): Promise<void> {
  const stale = await prisma.socialAccount.findMany({
    where: { accountId, platform: 'google_business', platformId: { startsWith: 'locations/' } },
  })
  if (stale.length === 0) return

  const available = await listAvailableLocations(accountId)
  for (const row of stale) {
    const match = available.find(l => l.id.endsWith(`/${row.platformId}`))
    if (!match) {
      await prisma.socialAccount.delete({ where: { id: row.id } })
      continue
    }
    const dupe = await prisma.socialAccount.findFirst({
      where: { accountId, platform: 'google_business', platformId: match.id, NOT: { id: row.id } },
      select: { id: true },
    })
    if (dupe) await prisma.socialAccount.delete({ where: { id: row.id } })
    else await prisma.socialAccount.update({ where: { id: row.id }, data: { platformId: match.id, name: match.title } })
  }
}

export async function fetchReviews(socialAccountId: string): Promise<GBPReview[]> {
  const { token, locationName } = await getTokenForLocation(socialAccountId)
  const all: GBPReview[] = []
  let pageToken: string | undefined

  do {
    const qs = new URLSearchParams({ pageSize: '50' })
    if (pageToken) qs.set('pageToken', pageToken)

    const res = await fetch(`${REVIEWS_API}/${locationName}/reviews?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`GBP reviews API error ${res.status}: ${txt}`)
    }
    const data = await res.json()

    for (const r of data.reviews ?? []) {
      all.push({
        name: r.name,
        reviewerName: r.reviewer?.displayName ?? 'Anonymous',
        starRating: STAR_MAP[r.starRating] ?? 0,
        comment: r.comment ?? null,
        createTime: r.createTime,
        replyComment: r.reviewReply?.comment ?? null,
        replyUpdateTime: r.reviewReply?.updateTime ?? null,
      })
    }

    pageToken = data.nextPageToken
  } while (pageToken)

  return all
}

export async function postReply(socialAccountId: string, reviewName: string, comment: string): Promise<void> {
  const { token } = await getTokenForLocation(socialAccountId)
  const res = await fetch(`${REVIEWS_API}/${reviewName}/reply`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`GBP reply API error ${res.status}: ${txt}`)
  }
}

export async function deleteReply(socialAccountId: string, reviewName: string): Promise<void> {
  const { token } = await getTokenForLocation(socialAccountId)
  await fetch(`${REVIEWS_API}/${reviewName}/reply`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
