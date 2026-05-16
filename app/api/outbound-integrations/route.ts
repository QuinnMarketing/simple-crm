import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json([])

  const integrations = await prisma.outboundIntegration.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(integrations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const { name, url, authType, authHeader, authValue } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!url?.trim()) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  const integration = await prisma.outboundIntegration.create({
    data: {
      accountId,
      name: String(name).trim().slice(0, 100),
      url: String(url).trim().slice(0, 500),
      authType: authType ?? 'none',
      authHeader: authHeader ? String(authHeader).trim().slice(0, 100) : null,
      authValue: authValue ? String(authValue).trim().slice(0, 500) : null,
    },
  })
  return NextResponse.json(integration, { status: 201 })
}
