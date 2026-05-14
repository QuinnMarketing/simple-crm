import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = getAccountFilter(session.user)
  const { projectId, name, startDate, endDate, assignee, status, progress, notes } = await req.json()
  if (!name?.trim() || !projectId || !startDate || !endDate) {
    return NextResponse.json({ error: 'name, projectId, startDate, endDate required' }, { status: 400 })
  }
  const project = await prisma.ganttProject.findFirst({ where: { id: projectId, ...filter } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const task = await prisma.ganttTask.create({
    data: {
      projectId,
      name: name.trim(),
      startDate,
      endDate,
      assignee: assignee?.trim() || null,
      status: status || 'not_started',
      progress: typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0,
      notes: notes?.trim() || null,
    },
  })
  return NextResponse.json(task)
}
