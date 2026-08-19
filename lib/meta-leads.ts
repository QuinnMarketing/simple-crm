const GRAPH = 'https://graph.facebook.com/v20.0'

export function systemToken(): string {
  return process.env.META_SYSTEM_USER_TOKEN ?? ''
}

// Subscribe a Facebook Page to our app for the `leadgen` field so Meta forwards
// its Instant Form leads to /api/webhooks/meta-leads. Best-effort, never throws.
export async function subscribePageToLeadgen(pageId: string, pageToken: string): Promise<{ ok: boolean; error?: string }> {
  if (!pageId || !pageToken) return { ok: false, error: 'missing page id or token' }
  try {
    const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ subscribed_fields: 'leadgen', access_token: pageToken }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'request failed' }
  }
}

export async function subscribePages(pages: { id: string; accessToken?: string }[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all(
    pages.map(async (p) => {
      const r = await subscribePageToLeadgen(p.id, p.accessToken ?? '')
      out[p.id] = r.ok ? 'subscribed' : (r.error ?? 'error')
    })
  )
  return out
}

// ── System User (Business Manager) helpers ─────────────────────────────────────
// One never-changing agency token manages every client Page in the Business
// Manager, so clients never touch OAuth. All calls use that token.

export type SystemPage = { id: string; name: string }

// Every Page the System User can manage.
export async function listSystemPages(): Promise<{ pages: SystemPage[]; error?: string }> {
  const token = systemToken()
  if (!token) return { pages: [], error: 'META_SYSTEM_USER_TOKEN not set' }
  const pages: SystemPage[] = []
  let url = `${GRAPH}/me/accounts?fields=id,name&limit=100&access_token=${token}`
  try {
    for (let guard = 0; guard < 20 && url; guard++) {
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) return { pages, error: data.error.message }
      for (const p of data.data ?? []) if (p.id) pages.push({ id: p.id, name: p.name ?? p.id })
      url = data.paging?.next ?? ''
    }
    return { pages }
  } catch (e) {
    return { pages, error: e instanceof Error ? e.message : 'request failed' }
  }
}

// The Page's own access token, derived from the System User token.
export async function getPageToken(pageId: string): Promise<string> {
  const token = systemToken()
  if (!token) return ''
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${token}`)
    const data = await res.json()
    return data.access_token ?? ''
  } catch {
    return ''
  }
}

// Subscribe a Page to our leadgen webhook using the System User token (fetches
// the page token first, since subscribed_apps needs a page-scoped token).
export async function subscribePageViaSystem(pageId: string): Promise<{ ok: boolean; error?: string }> {
  const pageToken = await getPageToken(pageId)
  if (!pageToken) return { ok: false, error: 'could not get page token' }
  return subscribePageToLeadgen(pageId, pageToken)
}

// Recent lead IDs for a Page (across its forms), newest first — for backfilling
// leads that arrived before the page was subscribed. Uses the page token.
export async function listRecentLeadIds(pageId: string, maxTotal = 50): Promise<{ leads: { leadgenId: string; formId: string }[]; error?: string }> {
  const pageToken = await getPageToken(pageId)
  if (!pageToken) return { leads: [], error: 'could not get page token' }
  try {
    const formsRes = await fetch(`${GRAPH}/${pageId}/leadgen_forms?fields=id,leads_count&limit=50&access_token=${pageToken}`)
    const formsData = await formsRes.json()
    if (formsData.error) return { leads: [], error: formsData.error.message }
    const forms = (formsData.data ?? []).filter((f: { leads_count?: number }) => (f.leads_count ?? 0) > 0)
    const leads: { leadgenId: string; formId: string }[] = []
    for (const form of forms) {
      if (leads.length >= maxTotal) break
      const res = await fetch(`${GRAPH}/${form.id}/leads?fields=id&limit=25&access_token=${pageToken}`)
      const data = await res.json()
      for (const l of data.data ?? []) {
        if (l.id) leads.push({ leadgenId: l.id, formId: form.id })
        if (leads.length >= maxTotal) break
      }
    }
    return { leads }
  } catch (e) {
    return { leads: [], error: e instanceof Error ? e.message : 'request failed' }
  }
}

// Read a single Instant Form lead's answers using the System User token.
export async function fetchLeadData(leadgenId: string): Promise<{ data: Record<string, unknown> | null; error?: string }> {
  const token = systemToken()
  if (!token) return { data: null, error: 'META_SYSTEM_USER_TOKEN not set' }
  try {
    const res = await fetch(`${GRAPH}/${leadgenId}?fields=field_data,created_time,ad_id,ad_name,campaign_name,form_id&access_token=${token}`)
    const data = await res.json()
    if (!res.ok || data.error) return { data: null, error: data?.error?.message ?? `HTTP ${res.status}` }
    return { data }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'request failed' }
  }
}
