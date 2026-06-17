import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null

  if (!accountId) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }

  const receipt = await prisma.pendingReceipt.findFirst({
    where: { id, accountId },
  })

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  }

  await prisma.pendingReceipt.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
