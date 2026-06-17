import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = getAccountFilter(session.user)
  const projects = await prisma.ganttProject.findMany({
    where: filter,
    include: { tasks: { orderBy: { startDate: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId ?? req.nextUrl.searchParams.get('account') ?? ''
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })
  const { name, description, color } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const project = await prisma.ganttProject.create({
    data: { accountId, name: name.trim(), description: description?.trim() || null, color: color || '#6366f1' },
    include: { tasks: true },
  })
  return NextResponse.json(project)
}
