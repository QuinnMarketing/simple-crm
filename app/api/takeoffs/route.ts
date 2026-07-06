import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

function calcTotals(lineItems: { quantity: number; unitCost: number; markup: number }[]) {
  const subtotal = lineItems.reduce((s, li) => {
    const base = (li.quantity ?? 0) * (li.unitCost ?? 0)
    return s + base * (1 + (li.markup ?? 0) / 100)
  }, 0)
  return { subtotal, total: subtotal }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountId)

  const takeoffs = await prisma.takeoff.findMany({
    where: filter,
    orderBy: { updatedAt: 'desc' },
    include: {
      project: { select: { id: true, name: true, color: true } },
      lead: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(takeoffs)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, projectId, leadId } = body

  // master_admin can pass accountId explicitly (scoped via ?account= param on the frontend)
  const accountId: string | null = body.accountId || session.user.accountId || null

  if (!accountId) {
    return NextResponse.json({ error: 'Select an account first' }, { status: 400 })
  }

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const takeoff = await prisma.takeoff.create({
    data: {
      accountId,
      name: name.trim(),
      description: description?.trim() || null,
      projectId: projectId || null,
      leadId: leadId || null,
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      lead: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(takeoff, { status: 201 })
}
