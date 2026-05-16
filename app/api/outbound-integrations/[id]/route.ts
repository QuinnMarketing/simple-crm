import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

async function getIntegration(id: string, accountId: string) {
  return prisma.outboundIntegration.findFirst({ where: { id, accountId } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const { id } = await params
  const existing = await getIntegration(id, accountId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, url, authType, authHeader, authValue, enabled } = body

  const updated = await prisma.outboundIntegration.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).trim().slice(0, 100) }),
      ...(url !== undefined && { url: String(url).trim().slice(0, 500) }),
      ...(authType !== undefined && { authType }),
      ...(authHeader !== undefined && { authHeader: authHeader ? String(authHeader).trim().slice(0, 100) : null }),
      ...(authValue !== undefined && { authValue: authValue ? String(authValue).trim().slice(0, 500) : null }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const { id } = await params
  const existing = await getIntegration(id, accountId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.outboundIntegration.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
