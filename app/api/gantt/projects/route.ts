import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)

  try {
    const projects = await prisma.ganttProject.findMany({
      where: filter,
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (err) {
    console.error('Failed to fetch projects:', err)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null

  if (!accountId) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { name, description, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Project name required' }, { status: 400 })
    }

    const project = await prisma.ganttProject.create({
      data: {
        accountId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6366f1',
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    console.error('Failed to create project:', err)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
