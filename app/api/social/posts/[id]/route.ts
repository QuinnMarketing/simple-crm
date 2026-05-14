import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { publishPost } from '@/lib/social-publish'
import { NextRequest, NextResponse } from 'next/server'

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const body = await req.json()
  const { content, mediaUrls, link, scheduledAt, publishNow } = body

  const existing = await prisma.socialPost.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (['published', 'publishing'].includes(existing.status)) {
    return NextResponse.json({ error: 'Cannot edit a published post' }, { status: 400 })
  }

  const post = await prisma.socialPost.update({
    where: { id },
    data: {
      ...(content !== undefined ? { content: content.trim() } : {}),
      ...(mediaUrls !== undefined ? { mediaUrls: JSON.stringify(mediaUrls) } : {}),
      ...(link !== undefined ? { link: link?.trim() || null } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
      ...(publishNow ? { status: 'publishing' } : scheduledAt !== undefined ? { status: scheduledAt ? 'scheduled' : 'draft' } : {}),
    },
    include: {
      targets: { include: { socialAccount: { select: { id: true, platform: true, name: true, pictureUrl: true } } } },
    },
  })

  if (publishNow) {
    await publishPost(post.id)
    const updated = await prisma.socialPost.findUnique({
      where: { id },
      include: { targets: { include: { socialAccount: { select: { id: true, platform: true, name: true, pictureUrl: true } } } } },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json(post)
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.socialPost.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.socialPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
