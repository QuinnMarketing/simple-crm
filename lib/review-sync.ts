import { prisma } from './prisma'
import { fetchReviews, discoverLocations, migrateLegacyLocationIds, postReply } from './google-reviews'
import { generateReviewReply } from './ai-review-reply'

export type ReviewSyncResult = {
  created: number
  updated: number
  autoReplied: number
  errors: string[]
}

// Cap AI replies per sync run — each generation takes a few seconds and the
// route/cron shares a 60s budget with the review fetches themselves. Anything
// over the cap is picked up on the next run.
const MAX_AI_REPLIES_PER_RUN = 8

/**
 * Syncs Google reviews for one account and, when auto-reply is enabled in
 * Review Settings, posts AI-generated replies — both for newly synced reviews
 * and as a backfill for older Google reviews that never got a reply.
 * Throws for setup problems (not connected, no locations); per-location fetch
 * failures are collected in `errors` instead.
 */
export async function syncAccountReviews(accountId: string): Promise<ReviewSyncResult> {
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'google_business' } },
  })
  if (!integration?.enabled) {
    throw new Error('Google Business not connected. Go to Social → Connect Google Business first.')
  }

  // Upgrade any legacy bare-format location IDs in place — they 404 against
  // the v4 reviews API, so syncing them without this is guaranteed to fail
  await migrateLegacyLocationIds(accountId)

  // Discover locations if none stored yet (first sync, or location fetch was skipped during OAuth)
  let socialAccounts = await prisma.socialAccount.findMany({
    where: { accountId, platform: 'google_business' },
  })
  if (socialAccounts.length === 0) {
    await discoverLocations(accountId)
    socialAccounts = await prisma.socialAccount.findMany({
      where: { accountId, platform: 'google_business' },
    })
  }
  if (socialAccounts.length === 0) {
    throw new Error('No Business Profile locations found. Make sure your profile has a verified location.')
  }

  // Load auto-reply settings and business name once for this account
  const [reviewSettings, account] = await Promise.all([
    prisma.reviewSettings.findUnique({ where: { accountId } }),
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
  ])
  let toneGuides: { positive?: string; neutral?: string; negative?: string } = {}
  if (reviewSettings?.replyTemplates) {
    try { toneGuides = JSON.parse(reviewSettings.replyTemplates) } catch { /* ignore */ }
  }
  const autoReply = reviewSettings?.autoReply ?? false
  const businessName = account?.name ?? 'our business'

  function getToneGuide(rating: number): string | undefined {
    if (rating >= 4) return toneGuides.positive?.trim() || undefined
    if (rating === 3) return toneGuides.neutral?.trim() || undefined
    return toneGuides.negative?.trim() || undefined
  }

  let created = 0
  let updated = 0
  let autoReplied = 0
  let aiBudget = MAX_AI_REPLIES_PER_RUN
  const errors: string[] = []

  for (const sa of socialAccounts) {
    try {
      const reviews = await fetchReviews(sa.id)

      for (const r of reviews) {
        if (!r.name || r.starRating === 0) continue

        const existing = await prisma.review.findFirst({
          where: { externalId: r.name },
        })

        if (existing) {
          if (r.replyComment !== existing.reply && r.replyComment) {
            // The reply on Google changed (e.g. edited in the GBP dashboard)
            await prisma.review.update({
              where: { id: existing.id },
              data: {
                reply: r.replyComment,
                repliedAt: r.replyUpdateTime ? new Date(r.replyUpdateTime) : null,
              },
            })
            updated++
          } else if (autoReply && !r.replyComment && !existing.reply && aiBudget > 0) {
            // Backfill: an already-synced Google review with no reply anywhere.
            // Post to GBP first — only save locally once Google accepted it.
            aiBudget--
            try {
              const aiReply = await generateReviewReply({
                reviewerName: r.reviewerName,
                rating: r.starRating,
                reviewText: r.comment,
                businessName,
                toneGuide: getToneGuide(r.starRating),
              })
              await postReply(sa.id, r.name, aiReply)
              await prisma.review.update({
                where: { id: existing.id },
                data: { reply: aiReply, repliedAt: new Date() },
              })
              autoReplied++
            } catch (e) {
              console.error(`Auto-reply backfill failed for ${r.name}:`, e)
            }
          }
        } else {
          // Generate AI reply if auto-reply is enabled and no GBP reply exists yet
          const shouldAutoReply = autoReply && !r.replyComment && aiBudget > 0
          let aiReply: string | null = null
          if (shouldAutoReply) {
            aiBudget--
            try {
              aiReply = await generateReviewReply({
                reviewerName: r.reviewerName,
                rating: r.starRating,
                reviewText: r.comment,
                businessName,
                toneGuide: getToneGuide(r.starRating),
              })
            } catch (e) {
              console.error(`AI reply generation failed for ${r.name}:`, e)
            }
          }

          const createdReview = await prisma.review.create({
            data: {
              accountId,
              reviewerName: r.reviewerName,
              rating: r.starRating,
              body: r.comment,
              reply: aiReply ?? r.replyComment,
              repliedAt: aiReply ? new Date() : (r.replyUpdateTime ? new Date(r.replyUpdateTime) : null),
              source: 'google',
              externalId: r.name,
              status: 'approved',
              createdAt: r.createTime ? new Date(r.createTime) : undefined,
            },
          })
          created++

          if (aiReply) {
            await postReply(sa.id, r.name, aiReply).catch((e) => {
              console.error(`Auto-reply post failed for ${r.name}:`, e)
              // Rollback the reply stored on the review so it stays accurate
              prisma.review.update({
                where: { id: createdReview.id },
                data: { reply: null, repliedAt: null },
              }).catch(() => {})
            })
            autoReplied++
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`GBP sync error for ${sa.platformId}:`, msg)
      errors.push(`${sa.name}: ${msg}`)
    }
  }

  return { created, updated, autoReplied, errors }
}
