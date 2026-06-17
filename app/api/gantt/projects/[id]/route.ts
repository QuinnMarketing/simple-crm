import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)

  try {
    const project = await prisma.ganttProject.findFirst({
      where: { id, ...filter },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, description, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Project name required' }, { status: 400 })
    }

    const updated = await prisma.ganttProject.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6366f1',
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Failed to update project:', err)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = getAccountFilter(session.user)

  try {
    const project = await prisma.ganttProject.findFirst({
      where: { id, ...filter },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    await prisma.ganttProject.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to delete project:', err)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
