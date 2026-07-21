import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const account = await prisma.account.findUnique({ where: { slug }, select: { id: true } })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await prisma.teamMember.findMany({
    where: { accountId: account.id, active: true },
    select: { id: true, name: true, role: true, bio: true, photoUrl: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 50,
  })
  return NextResponse.json({ members })
}
