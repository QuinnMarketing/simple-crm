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

async function refreshAccessToken(refreshTokenStr: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshTokenStr,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
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
export async function discoverLocations(accountId: string): Promise<number> {
  const token = await getTokenForAccount(accountId)

  const acctRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const acctData = await acctRes.json()
  if (!acctRes.ok || acctData.error) throw new Error(acctData.error?.message ?? `Account discovery failed (${acctRes.status})`)
  const gmbAccounts: Array<{ name: string }> = acctData.accounts ?? []
  if (gmbAccounts.length === 0) throw new Error('No Google Business accounts found')

  let count = 0
  for (const acct of gmbAccounts.slice(0, 10)) {
    const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acct.name}/locations?readMask=name,title`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const locData = await locRes.json()
    for (const loc of locData.locations ?? []) {
      // Get the integration refresh token to store against each location
      const integration = await prisma.accountIntegration.findUnique({
        where: { accountId_platform: { accountId, platform: 'google_business' } },
      })
      const cfg = integration ? JSON.parse(integration.config) : {}
      await prisma.socialAccount.upsert({
        where: { accountId_platform_platformId: { accountId, platform: 'google_business', platformId: loc.name } },
        create: { accountId, platform: 'google_business', platformId: loc.name, name: loc.title ?? loc.name, accessToken: token, refreshToken: cfg.refreshToken ?? null },
        update: { name: loc.title ?? loc.name, accessToken: token, refreshToken: cfg.refreshToken ?? null },
      })
      count++
    }
  }
  return count
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
