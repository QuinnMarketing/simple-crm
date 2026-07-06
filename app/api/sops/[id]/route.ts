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
  const sop = await prisma.sop.findFirst({ where: { id, ...filter } })
  if (!sop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(sop)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.sop.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const sop = await prisma.sop.update({
    where: { id },
    data: {
      ...('title' in body && body.title?.trim() ? { title: body.title.trim() } : {}),
      ...('category' in body ? { category: body.category?.trim() || null } : {}),
      ...('industry' in body ? { industry: body.industry?.trim() || null } : {}),
      ...('content' in body && typeof body.content === 'string' ? { content: body.content } : {}),
    },
  })

  after(() => logAudit({
    accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'sop.updated', entityType: 'sop', entityId: id, entityLabel: sop.title,
    ipAddress: getIp(req),
  }))

  return NextResponse.json(sop)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const existing = await prisma.sop.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.sop.delete({ where: { id } })

  after(() => logAudit({
    accountId: existing.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'sop.deleted', entityType: 'sop', entityId: id, entityLabel: existing.title,
    ipAddress: getIp(req),
  }))

  return NextResponse.json({ success: true })
}
