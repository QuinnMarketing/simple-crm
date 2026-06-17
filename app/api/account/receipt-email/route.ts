import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { slug: true, receiptEmailToken: true },
  })

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Generate receipt email address
  const domain = process.env.NEXTAUTH_URL?.split('://')[1]?.split(':')[0] || 'localhost'
  const receiptEmail = `${account.slug}-receipts-${account.receiptEmailToken}@${domain}`

  return NextResponse.json({
    receiptEmail,
    token: account.receiptEmailToken,
  })
}
