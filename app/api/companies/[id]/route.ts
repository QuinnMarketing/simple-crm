import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color } = await req.json()
  const filter = getAccountFilter(session.user)

  const existing = await prisma.company.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(color ? { color } : {}),
    },
    include: { _count: { select: { leads: true } } },
  })

  return NextResponse.json(company)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const existing = await prisma.company.findFirst({ where: { id, ...filter } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.lead.updateMany({ where: { companyId: id }, data: { companyId: null } })
  await prisma.company.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
