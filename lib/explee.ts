// Explee AutoGTM hot-leads client. One org-scoped API key pulls every hot lead
// (a prospect who replied with real interest) as a ready-to-use contact.
const EXPLEE_BASE = 'https://api.explee.com'

export type ExpleeHotLead = {
  name?: string
  email?: string
  job_title?: string
  company_name?: string
  company_domain?: string
  linkedin_url?: string
  country?: string
  phone?: string
  why_hot?: string
  became_hot_at?: string
  campaign_id?: number | string
  person_id?: number | string
}

type HotLeadsResponse = { leads?: ExpleeHotLead[]; total?: number; has_more?: boolean; next_offset?: number }

export function expleeKey(): string {
  return process.env.EXPLEE_API_KEY ?? ''
}

// Fetch every hot lead newer than `since` (ISO 8601), following pagination.
// Returns them oldest-first so the caller can advance its cursor safely.
export async function fetchHotLeadsSince(since: string | null): Promise<{ leads: ExpleeHotLead[]; error?: string }> {
  const key = expleeKey()
  if (!key) return { leads: [], error: 'EXPLEE_API_KEY not set' }

  const all: ExpleeHotLead[] = []
  let offset = 0
  const limit = 50
  try {
    for (let page = 0; page < 40; page++) { // hard cap: 2000 leads/run
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      if (since) qs.set('since', since)
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 20_000)
      let res: Response
      try {
        res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/hot-leads?${qs}`, {
          headers: { 'X-API-Key': key, Accept: 'application/json' },
          signal: ctrl.signal,
        })
      } finally { clearTimeout(t) }
      if (!res.ok) return { leads: all, error: `Explee API ${res.status}` }
      const data = (await res.json()) as HotLeadsResponse
      const batch = data.leads ?? []
      all.push(...batch)
      if (!data.has_more || batch.length === 0) break
      offset = typeof data.next_offset === 'number' ? data.next_offset : offset + limit
    }
  } catch (e) {
    return { leads: all, error: e instanceof Error ? e.message : 'request failed' }
  }

  // API returns newest-first; ingest oldest-first so a crash mid-run doesn't
  // skip older leads when we persist the newest became_hot_at.
  all.sort((a, b) => String(a.became_hot_at ?? '').localeCompare(String(b.became_hot_at ?? '')))
  return { leads: all }
}
