import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null

  if (!accountId) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }

  const pendingReceipts = await prisma.pendingReceipt.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(pendingReceipts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null

  if (!accountId) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }

  const body = await req.json()
  const { receiptId, projectId, category, notes } = body

  if (!receiptId || !projectId) {
    return NextResponse.json(
      { error: 'receiptId and projectId required' },
      { status: 400 }
    )
  }

  // Verify receipt exists and belongs to user's account
  const receipt = await prisma.pendingReceipt.findFirst({
    where: { id: receiptId, accountId },
  })

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  }

  // Verify project exists and belongs to user's account
  const project = await prisma.ganttProject.findFirst({
    where: { id: projectId, accountId },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Create expense from receipt
  const expense = await prisma.expense.create({
    data: {
      projectId,
      accountId,
      amount: receipt.amount ?? 0,
      vendor: receipt.vendor ?? undefined,
      date: receipt.date ?? new Date(),
      imageUrl: receipt.imageUrl || undefined,
      ocrData: receipt.ocrData ?? undefined,
      category: category ?? undefined,
      description: receipt.fileName || undefined,
      notes: notes ?? receipt.notes ?? undefined,
      status: 'pending',
    },
  })

  // Delete pending receipt
  await prisma.pendingReceipt.delete({ where: { id: receiptId } })

  return NextResponse.json({ success: true, expense })
}
