/**
 * Derives a human-readable lead source from attribution data, so leads stop
 * showing up as generic "webhook". Priority: explicit UTM source → ad-platform
 * click IDs → referrer/page domain → generic website.
 */

const UTM_SOURCE_LABELS: Record<string, string> = {
  google: 'Google Ads',
  adwords: 'Google Ads',
  facebook: 'Facebook',
  fb: 'Facebook',
  instagram: 'Instagram',
  ig: 'Instagram',
  meta: 'Facebook',
  linkedin: 'LinkedIn',
  bing: 'Bing Ads',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  email: 'Email',
  newsletter: 'Email',
}

export function deriveLeadSource(data: {
  utmSource?: string | null
  utmMedium?: string | null
  gclid?: string | null
  fbclid?: string | null
  pageUrl?: string | null
}): string | null {
  // 1. Explicit UTM source wins — normalise well-known values
  if (data.utmSource) {
    const key = data.utmSource.toLowerCase().trim()
    const label = UTM_SOURCE_LABELS[key]
    if (label) {
      // Distinguish paid vs organic social when medium says so
      if (label === 'Facebook' && data.utmMedium?.toLowerCase().includes('paid')) return 'Facebook Ads'
      return label
    }
    return data.utmSource
  }

  // 2. Ad click IDs are definitive even without UTMs
  if (data.gclid) return 'Google Ads'
  if (data.fbclid) return 'Facebook'

  // 3. Fall back to the page/referrer domain
  if (data.pageUrl) {
    try {
      const host = new URL(data.pageUrl).hostname.replace(/^www\./, '')
      if (host.includes('facebook.com')) return 'Facebook'
      if (host.includes('instagram.com')) return 'Instagram'
      if (host.includes('google.')) return 'Google'
      if (host) return `Website (${host})`
    } catch {
      // not a valid URL — ignore
    }
  }

  return null
}
