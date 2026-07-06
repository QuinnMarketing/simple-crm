/**
 * Topical stock photos for landing page backgrounds, via the Pexels API
 * (free key from pexels.com/api, set as PEXELS_API_KEY). Called once at
 * page-generation time; the chosen URLs are stored in the page content,
 * so serving pages never depends on Pexels being up or the key existing.
 * Returns [] when no key is configured — pages then render the plain
 * dark hero, same as before images existed.
 */
export async function searchStockImages(query: string, count = 8): Promise<string[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey || !query.trim()) return []

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      orientation: 'landscape',
      per_page: String(count),
    })
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) return []
    const data = await res.json() as { photos?: { src?: { landscape?: string } }[] }
    return (data.photos ?? [])
      .map(p => p.src?.landscape)
      .filter((u): u is string => !!u)
  } catch {
    return []
  }
}
