import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const accountParam = searchParams.get('account') ?? undefined
  const filter = getAccountFilter(session.user, accountParam)

  const accounts = await prisma.socialAccount.findMany({
    where: filter,
    select: { id: true, platform: true, platformId: true, name: true, pictureUrl: true, createdAt: true },
    orderBy: [{ platform: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(accounts)
}
