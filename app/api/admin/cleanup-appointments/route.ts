import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const session = await auth()
  if (!session || session.user.role !== 'master_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { count } = await prisma.appointment.deleteMany({
    where: { title: { startsWith: 'Follow up: ' } },
  })

  return NextResponse.json({ deleted: count })
}
