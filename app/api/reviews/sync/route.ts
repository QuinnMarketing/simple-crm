import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { fetchReviews, discoverLocations } from '@/lib/google-reviews'

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

  let created = 0
  let updated = 0
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
          await prisma.review.create({
            data: {
              accountId,
              reviewerName: r.reviewerName,
              rating: r.starRating,
              body: r.comment,
              reply: r.replyComment,
              repliedAt: r.replyUpdateTime ? new Date(r.replyUpdateTime) : null,
              source: 'google',
              externalId: r.name,
              status: 'approved',
              createdAt: r.createTime ? new Date(r.createTime) : undefined,
            },
          })
          created++
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`GBP sync error for ${sa.platformId}:`, msg)
      errors.push(`${sa.name}: ${msg}`)
    }
  }

  return NextResponse.json({ created, updated, errors })
}
