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

export interface StockVideo {
  url: string          // direct MP4 file URL
  posterUrl: string     // still frame, for the <video poster> attribute
  width: number
  height: number
  durationSec: number
}

/**
 * Stock video clips via the Pexels Videos API (same key/account as photos,
 * different endpoint). Used for hero background video etc. Picks the HD
 * (~1280px wide) MP4 variant when available to balance quality and page
 * weight — falls back to the largest available otherwise.
 */
export async function searchStockVideos(query: string, count = 6): Promise<StockVideo[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey || !query.trim()) return []

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      orientation: 'landscape',
      per_page: String(count),
    })
    const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) return []
    const data = await res.json() as {
      videos?: {
        image?: string
        duration?: number
        video_files?: { link: string; width: number; height: number; file_type: string; quality: string }[]
      }[]
    }
    return (data.videos ?? [])
      .map((v): StockVideo | null => {
        const files = (v.video_files ?? []).filter(f => f.file_type === 'video/mp4')
        if (files.length === 0 || !v.image) return null
        const hd = files.find(f => f.quality === 'hd' && f.width <= 1280) ?? files.find(f => f.quality === 'hd')
        const chosen = hd ?? files.sort((a, b) => b.width - a.width)[0]
        return {
          url: chosen.link,
          posterUrl: v.image,
          width: chosen.width,
          height: chosen.height,
          durationSec: v.duration ?? 0,
        }
      })
      .filter((v): v is StockVideo => v !== null)
  } catch {
    return []
  }
}

/**
 * Portrait photos of people — used for the ideal-customer avatar's face.
 * Returns [] when no key is configured, so the feature degrades to an
 * illustrated fallback rather than breaking.
 */
export async function searchPortraitImages(query: string, count = 8): Promise<string[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey || !query.trim()) return []

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      orientation: 'portrait',
      per_page: String(count),
    })
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) return []
    const data = await res.json() as { photos?: { src?: { portrait?: string; large?: string } }[] }
    return (data.photos ?? [])
      .map(p => p.src?.portrait ?? p.src?.large)
      .filter((u): u is string => !!u)
  } catch {
    return []
  }
}
