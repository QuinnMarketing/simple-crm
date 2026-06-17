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
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(projects)
}
