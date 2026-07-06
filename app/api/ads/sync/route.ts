import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { syncAccount, syncAllForCrmAccount } from '@/lib/ads/sync'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { adPlatformAccountId } = body as { adPlatformAccountId?: string }

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''

  if (adPlatformAccountId) {
    const result = await syncAccount(adPlatformAccountId)
    return NextResponse.json(result)
  }

  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const results = await syncAllForCrmAccount(accountId)
  return NextResponse.json({ results })
}
