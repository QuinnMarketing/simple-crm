import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const qAccountId = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, qAccountId)

  const automation = await prisma.automation.findFirst({ where: { id, ...filter }, select: { id: true } })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const runs = await prisma.automationRun.findMany({
    where: { automationId: id },
    include: { stepLogs: { orderBy: { executedAt: 'asc' } } },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(runs)
}
