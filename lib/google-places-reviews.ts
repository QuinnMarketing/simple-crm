import { prisma } from './prisma'

const PLACES_API = 'https://places.googleapis.com/v1/places'

interface PlacesReview {
  name: string // places/{placeId}/reviews/{reviewId} — used as externalId for dedup
  rating: number
  text?: { text: string }
  authorAttribution?: { displayName: string }
  publishTime: string
}

export type PlacesReviewSyncResult = {
  created: number
  skipped: number
}

/**
 * Pulls reviews for an account's Google Place via the Places API (New) using
 * a plain API key — no OAuth / Business Profile ownership required, unlike
 * syncAccountReviews() in review-sync.ts. Trade-off: Google returns only up
 * to 5 "most relevant" reviews per place, not the full history, and there's
 * no reply-posting capability (Places API is read-only).
 *
 * New reviews default to 'pending' (not 'approved' like the GBP sync) —
 * Google's relevance ranking can surface an outlier low-rating review
 * alongside genuinely representative ones, so this source needs a manual
 * curation pass before anything shows on the public widget.
 */
export async function syncAccountReviewsFromPlaces(accountId: string): Promise<PlacesReviewSyncResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured')

  const settings = await prisma.reviewSettings.findUnique({ where: { accountId } })
  const placeId = settings?.googlePlaceId
  if (!placeId) throw new Error('No Google Place ID set for this account (Review Settings)')

  const res = await fetch(`${PLACES_API}/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,rating,userRatingCount,reviews',
    },
  })
  if (!res.ok) throw new Error(`Places API request failed: ${await res.text()}`)
  const data = await res.json() as { reviews?: PlacesReview[] }
  const reviews = data.reviews ?? []

  let created = 0
  let skipped = 0

  for (const r of reviews) {
    if (!r.name || !r.rating) { skipped++; continue }
    const existing = await prisma.review.findFirst({ where: { externalId: r.name } })
    if (existing) { skipped++; continue }

    await prisma.review.create({
      data: {
        accountId,
        reviewerName: r.authorAttribution?.displayName ?? 'Google User',
        rating: r.rating,
        body: r.text?.text ?? null,
        source: 'google',
        externalId: r.name,
        status: 'pending',
        createdAt: r.publishTime ? new Date(r.publishTime) : undefined,
      },
    })
    created++
  }

  return { created, skipped }
}
