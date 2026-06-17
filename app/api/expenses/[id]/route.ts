import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

async function getExpense(id: string, user: any) {
  const filter = getAccountFilter(user)
  return prisma.expense.findFirst({
    where: { id, ...filter },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const expense = await getExpense(id, session.user)

  if (!expense) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(expense)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getExpense(id, session.user)

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { amount, currency, vendor, category, description, date, imageUrl, status } = body

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(currency && { currency }),
      ...(vendor && { vendor }),
      ...(category && { category }),
      ...(description !== undefined && { description: description || null }),
      ...(date && { date: new Date(date) }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      ...(status && { status }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getExpense(id, session.user)

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
