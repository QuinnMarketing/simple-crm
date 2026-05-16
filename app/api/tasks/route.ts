import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const leadId = searchParams.get('leadId')
  const overdue = searchParams.get('overdue') === 'true'
  const limit = parseInt(searchParams.get('limit') ?? '100', 10)
  const queryAccountId = searchParams.get('account')

  const accountFilter = getAccountFilter(session.user, queryAccountId)

  const now = new Date()

  const tasks = await prisma.task.findMany({
    where: {
      ...accountFilter,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(leadId ? { leadId } : {}),
      ...(overdue
        ? {
            status: { not: 'done' },
            dueDate: { lt: now },
          }
        : {}),
    },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: [
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const queryAccountId = req.nextUrl.searchParams.get('account')

  // master_admin can pass ?account= to target a specific account
  let accountId: string | null
  if (session.user.role === 'master_admin' && queryAccountId) {
    accountId = queryAccountId
  } else {
    accountId = session.user.accountId ?? null
  }

  const body = await req.json()
  const { title, description, status, priority, dueDate, leadId } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      leadId: leadId || null,
      accountId,
    },
    include: { lead: { select: { id: true, name: true } } },
  })

  return NextResponse.json(task, { status: 201 })
}
