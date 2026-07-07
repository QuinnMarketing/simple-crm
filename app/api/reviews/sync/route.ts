import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { fetchReviews, discoverLocations, migrateLegacyLocationIds, postReply } from '@/lib/google-reviews'
import { generateReviewReply } from '@/lib/ai-review-reply'

// Location migration + per-location review fetch + AI auto-replies can
// comfortably exceed the 10s default
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountParam } = await req.json()
  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })

  // Ensure the integration exists (credential check)
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'google_business' } },
  })
  if (!integration?.enabled) {
    return NextResponse.json({ error: 'Google Business not connected. Go to Social → Connect Google Business first.' }, { status: 400 })
  }

  // Upgrade any legacy bare-format location IDs in place — they 404 against
  // the v4 reviews API, so syncing them without this is guaranteed to fail
  try {
    await migrateLegacyLocationIds(accountId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Location migration failed: ${msg}` }, { status: 400 })
  }

  // Discover locations if none stored yet (first sync, or location fetch was skipped during OAuth)
  let socialAccounts = await prisma.socialAccount.findMany({
    where: { accountId, platform: 'google_business' },
  })

  if (socialAccounts.length === 0) {
    try {
      await discoverLocations(accountId)
      socialAccounts = await prisma.socialAccount.findMany({
        where: { accountId, platform: 'google_business' },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `Location discovery failed: ${msg}` }, { status: 400 })
    }
  }

  if (socialAccounts.length === 0) {
    return NextResponse.json({ error: 'No Business Profile locations found. Make sure your profile has a verified location.' }, { status: 400 })
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
          if (r.replyComment !== existing.reply) {
            await prisma.review.update({
              where: { id: existing.id },
              data: {
                reply: r.replyComment,
                repliedAt: r.replyUpdateTime ? new Date(r.replyUpdateTime) : null,
              },
            })
            updated++
          }
        } else {
          // Generate AI reply if auto-reply is enabled and no GBP reply exists yet
          const shouldAutoReply = autoReply && !r.replyComment
          let aiReply: string | null = null
          if (shouldAutoReply) {
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

          const created_review = await prisma.review.create({
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
                where: { id: created_review.id },
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

  return NextResponse.json({ created, updated, autoReplied, errors })
}
