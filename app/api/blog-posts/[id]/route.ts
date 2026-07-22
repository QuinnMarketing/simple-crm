import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { requireModule } from '@/lib/account-modules'
import type { Session } from 'next-auth'

async function getPost(id: string, user: Session['user']) {
  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) return null
  const filter = getAccountFilter(user)
  if (typeof filter.accountId === 'string' && filter.accountId !== post.accountId) return null
  if (typeof filter.accountId === 'object' && 'in' in filter.accountId && !filter.accountId.in.includes(post.accountId)) return null
  return post
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'blog'); if (gate) return gate

  const { id } = await params
  const post = await getPost(id, session.user)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { title, excerpt, body: postBody, coverImageUrl, category, publishedAt } = body

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = String(title).trim().slice(0, 200)
  if (excerpt !== undefined) data.excerpt = excerpt ? String(excerpt).trim().slice(0, 500) : null
  if (postBody !== undefined) data.body = String(postBody)
  if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl ? String(coverImageUrl).trim().slice(0, 2000) : null
  if (category !== undefined) data.category = category ? String(category).trim().slice(0, 100) : null
  if (publishedAt !== undefined) data.publishedAt = publishedAt ? new Date(publishedAt) : null

  const updated = await prisma.blogPost.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'blog'); if (gate) return gate

  const { id } = await params
  const post = await getPost(id, session.user)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.blogPost.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
