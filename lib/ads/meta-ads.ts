import crypto from 'crypto'

const GRAPH = 'https://graph.facebook.com/v20.0'

function appId() { return process.env.FACEBOOK_APP_ID ?? '' }
function appSecret() { return process.env.FACEBOOK_APP_SECRET ?? '' }

export function getAuthUrl(state: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const scopes = 'ads_management,ads_read,business_management,pages_show_list'
  return `${GRAPH.replace('graph', 'www')}/dialog/oauth?client_id=${appId()}&redirect_uri=${encodeURIComponent(`${base}/api/ads/callback/meta_ads`)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; email?: string }> {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${appId()}&redirect_uri=${encodeURIComponent(`${base}/api/ads/callback/meta_ads`)}&client_secret=${appSecret()}&code=${code}`
  )
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Token exchange failed')

  // Exchange short-lived for long-lived
  const extendRes = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId()}&client_secret=${appSecret()}&fb_exchange_token=${data.access_token}`
  )
  const extended = await extendRes.json()
  const longToken: string = extended.access_token ?? data.access_token

  let email: string | undefined
  try {
    const meRes = await fetch(`${GRAPH}/me?fields=email&access_token=${longToken}`)
    if (meRes.ok) email = (await meRes.json()).email
  } catch { /* best-effort */ }

  return { accessToken: longToken, email }
}

// ─── Ad Accounts ───────────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string
  name: string
  currency: string
  timezone: string
  accountStatus: number
}

export async function listAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const res = await fetch(`${GRAPH}/me/adaccounts?fields=id,name,currency,timezone_name,account_status&access_token=${accessToken}&limit=50`)
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to fetch ad accounts')
  return (data.data ?? []).map((a: Record<string, unknown>) => ({
    id: String(a.id),
    name: String(a.name ?? ''),
    currency: String(a.currency ?? 'AUD'),
    timezone: String(a.timezone_name ?? 'Australia/Sydney'),
    accountStatus: Number(a.account_status ?? 0),
  }))
}

// ─── Campaigns ─────────────────────────────────────────────────────────────

export interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  dailyBudget?: number
  lifetimeBudget?: number
  startTime?: string
  stopTime?: string
}

export async function listCampaigns(accessToken: string, adAccountId: string): Promise<MetaCampaign[]> {
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time'
  const res = await fetch(`${GRAPH}/${accountId}/campaigns?fields=${fields}&limit=100&access_token=${accessToken}`)
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to fetch campaigns')
  return (data.data ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name: String(c.name ?? ''),
    status: String(c.status ?? 'PAUSED').toLowerCase(),
    objective: String(c.objective ?? ''),
    dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : undefined,
    lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : undefined,
    startTime: c.start_time as string | undefined,
    stopTime: c.stop_time as string | undefined,
  }))
}

// ─── Ad Sets ───────────────────────────────────────────────────────────────

export interface MetaAdSet {
  id: string
  campaignId: string
  name: string
  status: string
  dailyBudget?: number
  lifetimeBudget?: number
  bidAmount?: number
  billingEvent: string
  optimizationGoal: string
  targeting: Record<string, unknown>
}

export async function listAdSets(accessToken: string, campaignId: string): Promise<MetaAdSet[]> {
  const fields = 'id,name,status,daily_budget,lifetime_budget,bid_amount,billing_event,optimization_goal,targeting,campaign_id'
  const res = await fetch(`${GRAPH}/${campaignId}/adsets?fields=${fields}&limit=100&access_token=${accessToken}`)
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to fetch ad sets')
  return (data.data ?? []).map((s: Record<string, unknown>) => ({
    id: String(s.id),
    campaignId: String(s.campaign_id ?? campaignId),
    name: String(s.name ?? ''),
    status: String(s.status ?? 'PAUSED').toLowerCase(),
    dailyBudget: s.daily_budget ? Number(s.daily_budget) / 100 : undefined,
    lifetimeBudget: s.lifetime_budget ? Number(s.lifetime_budget) / 100 : undefined,
    bidAmount: s.bid_amount ? Number(s.bid_amount) / 100 : undefined,
    billingEvent: String(s.billing_event ?? ''),
    optimizationGoal: String(s.optimization_goal ?? ''),
    targeting: (s.targeting as Record<string, unknown>) ?? {},
  }))
}

// ─── Ads ───────────────────────────────────────────────────────────────────

export interface MetaAd {
  id: string
  adSetId: string
  name: string
  status: string
  creativeId?: string
  creativeBody?: string
  creativeTitle?: string
  creativeImageUrl?: string
  destinationUrl?: string
}

export async function listAds(accessToken: string, adSetId: string): Promise<MetaAd[]> {
  const fields = 'id,name,status,adset_id,creative{id,body,title,image_url,object_url}'
  const res = await fetch(`${GRAPH}/${adSetId}/ads?fields=${fields}&limit=100&access_token=${accessToken}`)
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to fetch ads')
  return (data.data ?? []).map((a: Record<string, unknown>) => {
    const creative = a.creative as Record<string, unknown> | undefined
    return {
      id: String(a.id),
      adSetId: String(a.adset_id ?? adSetId),
      name: String(a.name ?? ''),
      status: String(a.status ?? 'PAUSED').toLowerCase(),
      creativeId: creative?.id ? String(creative.id) : undefined,
      creativeBody: creative?.body ? String(creative.body) : undefined,
      creativeTitle: creative?.title ? String(creative.title) : undefined,
      creativeImageUrl: creative?.image_url ? String(creative.image_url) : undefined,
      destinationUrl: creative?.object_url ? String(creative.object_url) : undefined,
    }
  })
}

// ─── Insights ──────────────────────────────────────────────────────────────

export interface MetaInsightRow {
  entityId: string
  entityType: 'campaign' | 'adset' | 'ad'
  date: string
  impressions: number
  clicks: number
  spend: number
  actions?: Record<string, number>
}

export async function getInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string,
  level: 'campaign' | 'adset' | 'ad' = 'campaign'
): Promise<MetaInsightRow[]> {
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const fields = 'campaign_id,adset_id,ad_id,date_start,impressions,clicks,spend,actions,action_values'
  const params = new URLSearchParams({
    fields,
    time_range: JSON.stringify({ since, until }),
    level,
    time_increment: '1',
    limit: '500',
    access_token: accessToken,
  })
  const res = await fetch(`${GRAPH}/${accountId}/insights?${params}`)
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to fetch insights')

  const entityTypeMap = { campaign: 'campaign', adset: 'adset', ad: 'ad' } as const

  return (data.data ?? []).map((row: Record<string, unknown>) => {
    const entityId = level === 'campaign'
      ? String(row.campaign_id)
      : level === 'adset'
        ? String(row.adset_id)
        : String(row.ad_id)

    const actions = (row.actions as Array<{ action_type: string; value: string }> | undefined) ?? []
    const actionMap: Record<string, number> = {}
    for (const a of actions) actionMap[a.action_type] = Number(a.value)

    return {
      entityId,
      entityType: entityTypeMap[level],
      date: String(row.date_start),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      spend: Number(row.spend ?? 0),
      actions: actionMap,
    }
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string
  objective: string
  status?: string
  dailyBudget?: number
  lifetimeBudget?: number
  startTime?: string
  stopTime?: string
}

const OBJECTIVE_MAP: Record<string, string> = {
  awareness: 'BRAND_AWARENESS',
  traffic: 'LINK_CLICKS',
  leads: 'LEAD_GENERATION',
  sales: 'CONVERSIONS',
  conversions: 'CONVERSIONS',
  reach: 'REACH',
  video: 'VIDEO_VIEWS',
  app: 'APP_INSTALLS',
  messages: 'MESSAGES',
}

export async function createCampaign(
  accessToken: string,
  adAccountId: string,
  input: CreateCampaignInput
): Promise<string> {
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const body = new URLSearchParams({
    name: input.name,
    objective: OBJECTIVE_MAP[input.objective] ?? 'LINK_CLICKS',
    status: input.status ?? 'PAUSED',
    access_token: accessToken,
    ...(input.dailyBudget ? { daily_budget: String(Math.round(input.dailyBudget * 100)) } : {}),
    ...(input.lifetimeBudget ? { lifetime_budget: String(Math.round(input.lifetimeBudget * 100)) } : {}),
    ...(input.startTime ? { start_time: input.startTime } : {}),
    ...(input.stopTime ? { stop_time: input.stopTime } : {}),
  })
  const res = await fetch(`${GRAPH}/${accountId}/campaigns`, {
    method: 'POST',
    body,
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to create campaign')
  return String(data.id)
}

export interface CreateAdSetInput {
  campaignId: string
  name: string
  billingEvent: string
  optimizationGoal: string
  dailyBudget?: number
  bidAmount?: number
  targeting: Record<string, unknown>
  startTime?: string
  endTime?: string
}

export async function createAdSet(
  accessToken: string,
  adAccountId: string,
  input: CreateAdSetInput
): Promise<string> {
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const body = new URLSearchParams({
    name: input.name,
    campaign_id: input.campaignId,
    billing_event: input.billingEvent,
    optimization_goal: input.optimizationGoal,
    targeting: JSON.stringify(input.targeting),
    status: 'PAUSED',
    access_token: accessToken,
    ...(input.dailyBudget ? { daily_budget: String(Math.round(input.dailyBudget * 100)) } : {}),
    ...(input.bidAmount ? { bid_amount: String(Math.round(input.bidAmount * 100)) } : {}),
    ...(input.startTime ? { start_time: input.startTime } : {}),
    ...(input.endTime ? { end_time: input.endTime } : {}),
  })
  const res = await fetch(`${GRAPH}/${accountId}/adsets`, { method: 'POST', body })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to create ad set')
  return String(data.id)
}

export interface CreateAdInput {
  adSetId: string
  name: string
  headline: string
  body: string
  imageUrl?: string
  destinationUrl: string
  callToAction?: string
}

export async function createAd(
  accessToken: string,
  adAccountId: string,
  input: CreateAdInput
): Promise<string> {
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  // Create ad creative first
  const creativeBody = new URLSearchParams({
    name: `${input.name} Creative`,
    object_story_spec: JSON.stringify({
      page_id: '', // user must provide page_id in practice
      link_data: {
        message: input.body,
        name: input.headline,
        link: input.destinationUrl,
        ...(input.imageUrl ? { picture: input.imageUrl } : {}),
        call_to_action: { type: input.callToAction ?? 'LEARN_MORE', value: { link: input.destinationUrl } },
      },
    }),
    access_token: accessToken,
  })
  const creativeRes = await fetch(`${GRAPH}/${accountId}/adcreatives`, { method: 'POST', body: creativeBody })
  const creativeData = await creativeRes.json()
  if (!creativeRes.ok || creativeData.error) throw new Error(creativeData.error?.message ?? 'Failed to create ad creative')

  // Create ad
  const adBody = new URLSearchParams({
    name: input.name,
    adset_id: input.adSetId,
    creative: JSON.stringify({ creative_id: String(creativeData.id) }),
    status: 'PAUSED',
    access_token: accessToken,
  })
  const adRes = await fetch(`${GRAPH}/${accountId}/ads`, { method: 'POST', body: adBody })
  const adData = await adRes.json()
  if (!adRes.ok || adData.error) throw new Error(adData.error?.message ?? 'Failed to create ad')
  return String(adData.id)
}

export async function updateCampaignStatus(
  accessToken: string,
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED' | 'DELETED'
): Promise<void> {
  const res = await fetch(`${GRAPH}/${campaignId}`, {
    method: 'POST',
    body: new URLSearchParams({ status, access_token: accessToken }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to update campaign')
}

// ─── Custom Audiences ──────────────────────────────────────────────────────

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

export async function createCustomAudience(
  accessToken: string,
  adAccountId: string,
  name: string,
  description: string
): Promise<string> {
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const res = await fetch(`${GRAPH}/${accountId}/customaudiences`, {
    method: 'POST',
    body: new URLSearchParams({
      name,
      description,
      subtype: 'CUSTOM',
      customer_file_source: 'USER_PROVIDED_ONLY',
      access_token: accessToken,
    }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Failed to create custom audience')
  return String(data.id)
}

export async function uploadAudienceMembers(
  accessToken: string,
  audienceId: string,
  members: { email?: string; phone?: string; name?: string }[]
): Promise<number> {
  const schema: string[] = []
  if (members.some(m => m.email)) schema.push('EMAIL')
  if (members.some(m => m.phone)) schema.push('PHONE')
  if (members.some(m => m.name)) schema.push('FN', 'LN')

  const data = members.map(m => {
    const row: string[] = []
    if (schema.includes('EMAIL')) row.push(m.email ? hashValue(m.email) : '')
    if (schema.includes('PHONE')) row.push(m.phone ? hashValue(m.phone.replace(/\D/g, '')) : '')
    if (schema.includes('FN')) {
      const parts = (m.name ?? '').trim().split(/\s+/)
      row.push(hashValue(parts[0] ?? ''))
      if (schema.includes('LN')) row.push(hashValue(parts.slice(1).join(' ')))
    }
    return row
  })

  const res = await fetch(`${GRAPH}/${audienceId}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: { schema, data },
      access_token: accessToken,
    }),
  })
  const result = await res.json()
  if (!res.ok || result.error) throw new Error(result.error?.message ?? 'Upload failed')
  return result.num_received ?? data.length
}
