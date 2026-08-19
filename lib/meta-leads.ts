const GRAPH = 'https://graph.facebook.com/v20.0'

// Subscribe a Facebook Page to our app for the `leadgen` field so Meta forwards
// its Instant Form leads to /api/webhooks/meta-leads. Requires the page token to
// carry `pages_manage_metadata`. Best-effort: returns ok/error, never throws.
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
