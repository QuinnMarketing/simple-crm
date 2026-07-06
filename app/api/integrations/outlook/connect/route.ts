import { auth } from '@/auth'
import { getAuthUrl } from '@/lib/outlook'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.MICROSOFT_CLIENT_ID) {
    return NextResponse.json({ error: 'MICROSOFT_CLIENT_ID not configured' }, { status: 500 })
  }

  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) {
    return NextResponse.json({ error: 'No account selected — master_admin must pass ?account=ID' }, { status: 400 })
  }

  return NextResponse.redirect(getAuthUrl(accountId))
}
