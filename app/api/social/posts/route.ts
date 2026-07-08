import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { publishPost } from '@/lib/social-publish'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'social'); if (gate) return gate
  const { searchParams } = req.nextUrl
  const accountParam = searchParams.get('account') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const accountFilter = getAccountFilter(session.user, accountParam)

  const posts = await prisma.socialPost.findMany({
    where: { ...accountFilter, ...(status ? { status } : {}) },
    include: {
      targets: {
        include: { socialAccount: { select: { id: true, platform: true, name: true, pictureUrl: true } } },
      },
    },
    orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'social'); if (gate) return gate
  const { searchParams } = req.nextUrl
  const accountParam = searchParams.get('account') ?? undefined
  const accountFilter = getAccountFilter(session.user, accountParam)
  const accountId = (accountFilter as { accountId?: string }).accountId ?? session.user.accountId ?? null
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const body = await req.json()
  const { content, mediaUrls = [], link, scheduledAt, socialAccountIds, postNow } = body

  if (!content?.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  if (!Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one account to post to' }, { status: 400 })
  }

  const status = postNow ? 'publishing' : scheduledAt ? 'scheduled' : 'draft'

  const post = await prisma.socialPost.create({
    data: {
      accountId,
      content: content.trim(),
      mediaUrls: JSON.stringify(mediaUrls),
      link: link?.trim() || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status,
      targets: {
        create: socialAccountIds.map((id: string) => ({ socialAccountId: id })),
      },
    },
    include: {
      targets: {
        include: { socialAccount: { select: { id: true, platform: true, name: true, pictureUrl: true } } },
      },
    },
  })

  if (postNow) {
    await publishPost(post.id)
    const updated = await prisma.socialPost.findUnique({
      where: { id: post.id },
      include: { targets: { include: { socialAccount: { select: { id: true, platform: true, name: true, pictureUrl: true } } } } },
    })
    return NextResponse.json(updated, { status: 201 })
  }

  return NextResponse.json(post, { status: 201 })
}
