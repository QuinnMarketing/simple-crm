import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('projectId')
  const accountParam = searchParams.get('account')

  const filter = getAccountFilter(session.user, accountParam)

  // If projectId specified, verify user has access
  if (projectId) {
    const project = await prisma.ganttProject.findFirst({
      where: { id: projectId, ...filter },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  const expenses = await prisma.expense.findMany({
    where: projectId ? { projectId } : filter,
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId ?? null
  const body = await req.json()

  const { projectId, amount, currency, vendor, category, description, date, imageUrl, ocrData, status } = body

  if (!projectId || !amount) {
    return NextResponse.json({ error: 'projectId and amount required' }, { status: 400 })
  }

  // Verify user has access to the project
  const project = await prisma.ganttProject.findFirst({
    where: { id: projectId, accountId: accountId || undefined },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const expense = await prisma.expense.create({
    data: {
      projectId,
      accountId: accountId || '',
      amount: parseFloat(amount),
      currency: currency || 'AUD',
      vendor: vendor || null,
      category: category || null,
      description: description || null,
      date: date ? new Date(date) : new Date(),
      imageUrl: imageUrl || null,
      ocrData: ocrData || null,
      status: status || 'pending',
    },
  })

  return NextResponse.json(expense, { status: 201 })
}
