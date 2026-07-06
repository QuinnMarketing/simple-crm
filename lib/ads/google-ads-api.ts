import https from 'https'
import http from 'http'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v21'

// Use Node's raw https module to bypass any Next.js fetch instrumentation
function nodeRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<{ status: number; text: () => string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const transport = u.protocol === 'https:' ? https : http
    const req = transport.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: options.method ?? 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'node-https/1.0',
          ...options.headers,
          ...(options.body ? { 'Content-Length': Buffer.byteLength(options.body) } : {}),
        },
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          const captured = body
          resolve({ status: res.statusCode ?? 0, text: () => captured })
        })
      }
    )
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

function clientId() {
  return process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.GOOGLE_CALENDAR_CLIENT_ID ?? ''
}
function clientSecret() {
  return process.env.GOOGLE_ADS_CLIENT_SECRET ?? process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? ''
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/ads/callback/google_ads`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCode(code: string): Promise<{ refreshToken: string; email?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/ads/callback/google_ads`,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error_description ?? data.error ?? 'Token exchange failed')
  if (!data.refresh_token) throw new Error('No refresh token — reconnect with prompt=consent')

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
  const cid = clientId()
  const csec = clientSecret()
  console.log('[Google Ads] getAccessToken using clientId prefix:', cid.slice(0, 25))
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: cid,
      client_secret: csec,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  console.log('[Google Ads] token refresh:', { ok: res.ok, error: data?.error, hasToken: !!data?.access_token })
  if (!res.ok || data.error) throw new Error(data.error_description ?? data.error ?? 'Token refresh failed')
  if (!data.access_token) throw new Error('Token refresh succeeded but returned no access_token')
  return data.access_token as string
}

function devToken(override?: string): string {
  return override ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
}

function parseGadsBody(status: number, url: string, raw: string): unknown {
  if (status < 200 || status >= 300) {
    console.error('[Google Ads API] HTTP', status, url, '\nBody:', raw.slice(0, 1000))
    let msg = `HTTP ${status}`
    try {
      const data = JSON.parse(raw)
      const err = data?.error ?? data?.errors?.[0]
      if (err?.message) msg = err.message
      // Dig into GoogleAdsFailure nested details for the real error code + message
      const details = err?.details ?? []
      for (const d of details) {
        const innerErrors = d?.errors ?? []
        for (const ie of innerErrors) {
          const code = ie?.errorCode ? JSON.stringify(ie.errorCode) : null
          const innerMsg = ie?.message
          if (code || innerMsg) msg += ` | ${innerMsg ?? ''} ${code ?? ''}`
        }
      }
      if (msg === `HTTP ${status}`) msg = JSON.stringify(err ?? data).slice(0, 400)
    } catch {
      if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
        msg = `HTTP ${status} (HTML response) — URL: ${url}. Raw: ${raw.slice(0, 200)}`
      } else {
        msg = raw.slice(0, 400)
      }
    }
    throw new Error(msg)
  }
  return JSON.parse(raw)
}

async function parseGadsResponse(res: Response): Promise<unknown> {
  const raw = await res.text()
  return parseGadsBody(res.status, res.url, raw)
}

// ─── Accessible accounts (MCC children or direct) ──────────────────────────

export async function listAccessibleCustomers(refreshToken: string, developerToken: string) {
  const token = await getAccessToken(refreshToken)
  const url = `${GOOGLE_ADS_API}/customers:listAccessibleCustomers`
  const res = await nodeRequest(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': developerToken.trim(),
    },
  })
  if (res.status >= 400) return [] // non-MCC tokens can't use this endpoint — return empty gracefully
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = parseGadsBody(res.status, url, res.text()) as any
  return (data.resourceNames ?? []) as string[]
}

export async function getCustomerInfo(
  refreshToken: string,
  developerToken: string,
  customerId: string,
  diag: string[] = [],
  loginCustomerId?: string
) {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '').trim()
  const dt = developerToken.trim()
  diag.push(`clientId: ${clientId().slice(0, 20)}`)
  diag.push(`devToken length: ${dt.length}, prefix: ${dt.slice(0, 4)}`)
  diag.push(`customerId: ${cleanId}`)
  if (loginCustomerId) diag.push(`loginCustomerId: ${loginCustomerId}`)

  // Step 0: validate the access token carries the adwords scope
  const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`)
  const tokenInfoText = await tokenInfoRes.text()
  diag.push(`tokeninfo status: ${tokenInfoRes.status}`)
  if (!tokenInfoRes.ok) {
    throw new Error(
      `Access token is invalid (tokeninfo ${tokenInfoRes.status}: ${tokenInfoText.slice(0, 150)}). ` +
      `Please click "Connect Google Ads" again to get a fresh token.`
    )
  }
  const tokenInfo = JSON.parse(tokenInfoText) as { scope?: string; email?: string; aud?: string }
  diag.push(`token email: ${tokenInfo.email}, aud: ${tokenInfo.aud?.slice(0, 25)}, scopes: ${tokenInfo.scope}`)
  if (!tokenInfo.scope?.includes('adwords')) {
    throw new Error(
      `Access token is missing the Google Ads scope (scopes present: ${tokenInfo.scope ?? 'none'}). ` +
      `Fix: In Google Cloud Console → OAuth consent screen → Edit App → Add/remove scopes → ` +
      `add https://www.googleapis.com/auth/adwords → Save. Then reconnect Google Ads.`
    )
  }

  // Skip listAccessibleCustomers — it requires an MCC developer token.
  // Go straight to querying the specific customer via GAQL.
  const queryBody = JSON.stringify({
    query: `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1`,
  })
  const searchUrl = `${GOOGLE_ADS_API}/customers/${cleanId}/googleAds:search`
  const searchRes = await nodeRequest(searchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {} as Record<string, string>),
    },
    body: queryBody,
  })
  const searchBody = searchRes.text()
  diag.push(`search status: ${searchRes.status}, body: ${searchBody.slice(0, 200)}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = parseGadsBody(searchRes.status, searchUrl, searchBody) as any
  const customer = data.results?.[0]?.customer
  return {
    id: String(customer?.id ?? cleanId),
    name: customer?.descriptiveName ?? `Account ${cleanId}`,
    currencyCode: customer?.currencyCode ?? 'AUD',
    timezone: customer?.timeZone ?? 'Australia/Sydney',
  }
}

// ─── Campaigns ─────────────────────────────────────────────────────────────

export interface GoogleAdsCampaign {
  id: string
  name: string
  status: string
  channelType: string
  budgetAmountMicros: number
  budgetType: string
  startDate: string
  endDate?: string
}

export async function listCampaigns(
  refreshToken: string,
  customerId: string,
  developerTokenOverride?: string,
  loginCustomerId?: string
): Promise<GoogleAdsCampaign[]> {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '')
  const dt = devToken(developerTokenOverride)
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      campaign_budget.type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {} as Record<string, string>),
    },
    body: JSON.stringify({ query }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await parseGadsResponse(res) as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).map((r: any) => ({
    id: String(r.campaign.id),
    name: r.campaign.name,
    status: (r.campaign.status ?? 'UNKNOWN').toLowerCase(),
    channelType: r.campaign.advertisingChannelType ?? '',
    budgetAmountMicros: r.campaignBudget?.amountMicros ?? 0,
    budgetType: r.campaignBudget?.type === 'FIXED' ? 'lifetime' : 'daily',
    startDate: r.campaign.startDate ?? '',
    endDate: r.campaign.endDate,
  }))
}

// ─── Ad Groups ─────────────────────────────────────────────────────────────

export interface GoogleAdsAdGroup {
  id: string
  campaignId: string
  name: string
  status: string
  cpcBidMicros: number
}

export async function listAdGroups(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  developerTokenOverride?: string,
  loginCustomerId?: string
): Promise<GoogleAdsAdGroup[]> {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '')
  const dt = devToken(developerTokenOverride)
  const query = `
    SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros
    FROM ad_group
    WHERE campaign.id = ${campaignId} AND ad_group.status != 'REMOVED'
  `
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {} as Record<string, string>),
    },
    body: JSON.stringify({ query }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await parseGadsResponse(res) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).map((r: any) => ({
    id: String(r.adGroup.id),
    campaignId,
    name: r.adGroup.name,
    status: (r.adGroup.status ?? 'UNKNOWN').toLowerCase(),
    cpcBidMicros: r.adGroup.cpcBidMicros ?? 0,
  }))
}

// ─── Ads ───────────────────────────────────────────────────────────────────

export interface GoogleAd {
  id: string
  adGroupId: string
  name: string
  status: string
  type: string
  headline?: string
  finalUrl?: string
}

export async function listAds(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  developerTokenOverride?: string,
  loginCustomerId?: string
): Promise<GoogleAd[]> {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '')
  const dt = devToken(developerTokenOverride)
  const query = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.status,
      ad_group_ad.ad.type,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines
    FROM ad_group_ad
    WHERE ad_group.id = ${adGroupId} AND ad_group_ad.status != 'REMOVED'
  `
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {} as Record<string, string>),
    },
    body: JSON.stringify({ query }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await parseGadsResponse(res) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).map((r: any) => ({
    id: String(r.adGroupAd.ad.id),
    adGroupId,
    name: r.adGroupAd.ad.name ?? '',
    status: (r.adGroupAd.status ?? 'UNKNOWN').toLowerCase(),
    type: r.adGroupAd.ad.type ?? '',
    headline: r.adGroupAd.ad.responsiveSearchAd?.headlines?.[0]?.text,
    finalUrl: r.adGroupAd.ad.finalUrls?.[0],
  }))
}

// ─── Performance ───────────────────────────────────────────────────────────

export interface GoogleAdsMetrics {
  entityId: string
  entityType: 'campaign' | 'adset' | 'ad'
  date: string
  impressions: number
  clicks: number
  costMicros: number
  conversions: number
  conversionValue: number
}

export async function getCampaignPerformance(
  refreshToken: string,
  customerId: string,
  since: string,
  until: string,
  developerTokenOverride?: string,
  loginCustomerId?: string
): Promise<GoogleAdsMetrics[]> {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '')
  const dt = devToken(developerTokenOverride)
  const query = `
    SELECT
      campaign.id,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC
  `
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {} as Record<string, string>),
    },
    body: JSON.stringify({ query }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await parseGadsResponse(res) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).map((r: any) => ({
    entityId: String(r.campaign.id),
    entityType: 'campaign' as const,
    date: r.segments.date,
    impressions: Number(r.metrics.impressions ?? 0),
    clicks: Number(r.metrics.clicks ?? 0),
    costMicros: Number(r.metrics.costMicros ?? 0),
    conversions: Number(r.metrics.conversions ?? 0),
    conversionValue: Number(r.metrics.conversionsValue ?? 0),
  }))
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string
  objective: string
  budgetAmountMicros: number
  budgetType: 'daily' | 'lifetime'
  startDate: string
  endDate?: string
}

export async function createCampaign(
  refreshToken: string,
  customerId: string,
  input: CreateCampaignInput,
  developerTokenOverride?: string,
  loginCustomerId?: string
): Promise<string> {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '')
  const dt = devToken(developerTokenOverride)
  const loginHeader: Record<string, string> = loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}

  // 1. Create budget
  const budgetRes = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/campaignBudgets:mutate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...loginHeader,
    },
    body: JSON.stringify({
      operations: [{
        create: {
          name: `${input.name} Budget`,
          amountMicros: String(input.budgetAmountMicros),
          deliveryMethod: 'STANDARD',
          ...(input.budgetType === 'lifetime' ? { type: 'FIXED' } : {}),
        },
      }],
    }),
  })
  const budgetData = await budgetRes.json()
  if (!budgetRes.ok) throw new Error(JSON.stringify(budgetData?.error ?? budgetData))
  const budgetResourceName = budgetData.results?.[0]?.resourceName

  // 2. Map objective to channel type
  const channelType = (['sales', 'leads', 'conversions'].includes(input.objective))
    ? 'SEARCH'
    : input.objective === 'video' ? 'VIDEO' : 'SEARCH'

  // 3. Create campaign
  const campRes = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/campaigns:mutate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...loginHeader,
    },
    body: JSON.stringify({
      operations: [{
        create: {
          name: input.name,
          advertisingChannelType: channelType,
          status: 'PAUSED',
          campaignBudget: budgetResourceName,
          startDate: input.startDate.replace(/-/g, ''),
          ...(input.endDate ? { endDate: input.endDate.replace(/-/g, '') } : {}),
        },
      }],
    }),
  })
  const campData = await campRes.json()
  if (!campRes.ok) throw new Error(JSON.stringify(campData?.error ?? campData))
  const resourceName: string = campData.results?.[0]?.resourceName ?? ''
  return resourceName.split('/').pop() ?? ''
}

export async function updateCampaignStatus(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  status: 'ENABLED' | 'PAUSED',
  developerTokenOverride?: string,
  loginCustomerId?: string
): Promise<void> {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '')
  const dt = devToken(developerTokenOverride)
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/campaigns:mutate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {} as Record<string, string>),
    },
    body: JSON.stringify({
      operations: [{
        update: {
          resourceName: `customers/${cleanId}/campaigns/${campaignId}`,
          status,
        },
        updateMask: 'status',
      }],
    }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(JSON.stringify(data?.error ?? data))
  }
}

// ─── Customer Match (Custom Audience) ──────────────────────────────────────

export interface HashedMember { hashedEmail?: string; hashedPhone?: string }

export async function createCustomerMatchList(
  refreshToken: string,
  customerId: string,
  name: string,
  members: HashedMember[],
  developerTokenOverride?: string,
  loginCustomerId?: string
): Promise<string> {
  const token = await getAccessToken(refreshToken)
  const cleanId = customerId.replace(/-/g, '')
  const dt = devToken(developerTokenOverride)
  const loginHeader: Record<string, string> = loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}

  // Create user list
  const createRes = await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/userLists:mutate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': dt,
      'Content-Type': 'application/json',
      ...loginHeader,
    },
    body: JSON.stringify({
      operations: [{
        create: {
          name,
          description: 'CRM-derived audience',
          membershipStatus: 'OPEN',
          membershipLifeSpan: 540,
          crmBasedUserList: {
            uploadKeyType: 'CONTACT_INFO',
            dataSourceType: 'FIRST_PARTY',
          },
        },
      }],
    }),
  })
  const createData = await createRes.json()
  if (!createRes.ok) throw new Error(JSON.stringify(createData?.error ?? createData))
  const listResourceName: string = createData.results?.[0]?.resourceName ?? ''
  const listId = listResourceName.split('/').pop() ?? ''

  // Upload members
  const ops = members.map(m => ({
    create: {
      userList: listResourceName,
      userIdentifiers: [
        ...(m.hashedEmail ? [{ hashedEmail: m.hashedEmail }] : []),
        ...(m.hashedPhone ? [{ hashedPhoneNumber: m.hashedPhone }] : []),
      ],
    },
  }))

  if (ops.length > 0) {
    await fetch(`${GOOGLE_ADS_API}/customers/${cleanId}/offlineUserDataJobs:mutate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': dt,
        'Content-Type': 'application/json',
        ...loginHeader,
      },
      body: JSON.stringify({ operations: ops }),
    })
  }

  return listId
}
