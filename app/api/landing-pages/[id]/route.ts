import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { logAudit, getIp } from '@/lib/audit'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const page = await prisma.landingPage.findFirst({
    where: { id, ...filter },
    include: { account: { select: { businessPhone: true } } },
  })
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const leads = await prisma.lead.count({ where: { pageUrl: { contains: `/lp/${page.slug}` } } })
  return NextResponse.json({ ...page, businessPhone: page.account?.businessPhone ?? null, leads })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.landingPage.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Slug edits: normalize, validate, and reject collisions with a clear error
  let slugUpdate: { slug: string } | Record<string, never> = {}
  if ('slug' in body && typeof body.slug === 'string') {
    const slug = body.slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (slug.length < 3) return NextResponse.json({ error: 'URL must be at least 3 characters (letters, numbers, dashes)' }, { status: 400 })
    if (slug !== existing.slug) {
      const taken = await prisma.landingPage.findUnique({ where: { slug }, select: { id: true } })
      if (taken) return NextResponse.json({ error: `The URL /lp/${slug} is already in use — pick another` }, { status: 409 })
      slugUpdate = { slug }
    }
  }

  const page = await prisma.landingPage.update({
    where: { id },
    data: {
      ...('name' in body && body.name?.trim() ? { name: body.name.trim() } : {}),
      ...('status' in body && ['draft', 'published'].includes(body.status) ? { status: body.status } : {}),
      ...('goal' in body && ['form', 'call', 'both'].includes(body.goal) ? { goal: body.goal } : {}),
      ...slugUpdate,
      ...('content' in body && typeof body.content === 'object' && body.content !== null
        ? { content: JSON.stringify(body.content) }
        : {}),
    },
  })

  after(() => logAudit({
    accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'landing_page.updated', entityType: 'landing_page', entityId: id, entityLabel: page.name,
    ipAddress: getIp(req),
  }))

  return NextResponse.json(page)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.landingPage.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.landingPage.delete({ where: { id } })

  after(() => logAudit({
    accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'landing_page.deleted', entityType: 'landing_page', entityId: id, entityLabel: existing.name,
    ipAddress: getIp(req),
  }))

  return NextResponse.json({ success: true })
}
