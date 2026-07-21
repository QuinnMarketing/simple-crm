import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; postSlug: string }> }
) {
  const { slug, postSlug } = await params
  const account = await prisma.account.findUnique({ where: { slug }, select: { id: true } })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const post = await prisma.blogPost.findUnique({
    where: { accountId_slug: { accountId: account.id, slug: postSlug } },
    select: {
      slug: true, title: true, excerpt: true, body: true, coverImageUrl: true, category: true, publishedAt: true,
    },
  })
  if (!post || !post.publishedAt || post.publishedAt > new Date()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(post)
}
