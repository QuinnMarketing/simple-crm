import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// Dismiss an unmatched synced email (e.g. spam/newsletter) without creating a lead
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account not found' }, { status: 400 })

  const email = await prisma.syncedEmail.findFirst({ where: { id, accountId } })
  if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.syncedEmail.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
