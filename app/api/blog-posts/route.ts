import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'

function slugify(input: string): string {
  return input.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'blog'); if (gate) return gate

  const accountParam = req.nextUrl.searchParams.get('account') ?? undefined
  const filter = getAccountFilter(session.user, accountParam)

  const posts = await prisma.blogPost.findMany({
    where: filter,
    orderBy: [{ createdAt: 'desc' }],
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'blog'); if (gate) return gate

  const body = await req.json()
  const { accountParam, title, slug, excerpt, body: postBody, coverImageUrl, category, publishedAt } = body

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!postBody?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const finalSlug = slugify(slug?.trim() || title)
  if (!finalSlug) return NextResponse.json({ error: 'Could not derive a slug from the title' }, { status: 400 })

  const existing = await prisma.blogPost.findUnique({ where: { accountId_slug: { accountId, slug: finalSlug } } })
  if (existing) return NextResponse.json({ error: 'A post with that slug already exists' }, { status: 409 })

  const post = await prisma.blogPost.create({
    data: {
      accountId,
      title: String(title).trim().slice(0, 200),
      slug: finalSlug,
      excerpt: excerpt ? String(excerpt).trim().slice(0, 500) : null,
      body: String(postBody),
      coverImageUrl: coverImageUrl ? String(coverImageUrl).trim().slice(0, 2000) : null,
      category: category ? String(category).trim().slice(0, 100) : null,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
    },
  })
  return NextResponse.json(post, { status: 201 })
}
