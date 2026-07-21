import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const account = await prisma.account.findUnique({ where: { slug }, select: { id: true } })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const posts = await prisma.blogPost.findMany({
    where: { accountId: account.id, publishedAt: { not: null, lte: new Date() } },
    select: {
      slug: true, title: true, excerpt: true, coverImageUrl: true, category: true, publishedAt: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ posts })
}
