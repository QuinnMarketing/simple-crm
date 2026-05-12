import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const accountId = session.user.accountId ?? null

  const existing = await prisma.documentTemplate.findFirst({ where: { id, ...(accountId ? { accountId } : {}) } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.documentTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
