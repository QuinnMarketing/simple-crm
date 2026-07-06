import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account not found' }, { status: 400 })

  const emails = await prisma.syncedEmail.findMany({
    where: { accountId, leadId: null },
    orderBy: { sentAt: 'desc' },
    take: 200,
  })

  return NextResponse.json(emails)
}
