import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

// Resolves the current account's slug so the Install panel can render a
// ready-to-paste snippet instead of a YOUR_ACCOUNT_SLUG placeholder.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountParam = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountParam)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null
  if (!accountId) return NextResponse.json({ slug: null })

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { slug: true, name: true },
  })
  return NextResponse.json({ slug: account?.slug ?? null, name: account?.name ?? null })
}
