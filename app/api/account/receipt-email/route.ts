import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  let account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { slug: true, receiptEmailToken: true },
  })

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Generate token if not already set
  if (!account.receiptEmailToken) {
    const token = randomBytes(6).toString('hex')
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: { receiptEmailToken: token },
      select: { slug: true, receiptEmailToken: true },
    })
    account = updated
  }

  // Generate receipt email address
  const domain = process.env.NEXTAUTH_URL?.split('://')[1]?.split(':')[0] || 'localhost'
  const receiptEmail = `${account.slug}-receipts-${account.receiptEmailToken}@${domain}`

  return NextResponse.json({
    receiptEmail,
    token: account.receiptEmailToken,
  })
}
