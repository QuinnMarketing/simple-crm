import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { generateCustomerAvatar } from '@/lib/customer-avatar-ai'
import { NextRequest, NextResponse } from 'next/server'

// Claude call — allow up to 60s
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'target_customer'); if (gate) return gate

  const body = await req.json().catch(() => ({}))
  const accountId =
    session.user.role === 'master_admin' ? (body.accountId ?? null) : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  // Optional owner-provided answers (from onboarding questions or the page)
  const hints = typeof body.hints === 'object' && body.hints !== null ? body.hints : undefined

  let generated
  try {
    generated = await generateCustomerAvatar(accountId, hints)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 502 })
  }

  // Regenerate onto an existing persona (keep its id + primary flag) if given
  const targetId = typeof body.id === 'string' ? body.id : null
  if (targetId) {
    const existing = await prisma.customerAvatar.findFirst({ where: { id: targetId, accountId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = await prisma.customerAvatar.update({
      where: { id: targetId },
      data: { ...generated, source: 'ai' },
    })
    return NextResponse.json(updated)
  }

  const count = await prisma.customerAvatar.count({ where: { accountId } })
  const avatar = await prisma.customerAvatar.create({
    data: {
      accountId,
      ...generated,
      source: 'ai',
      isPrimary: count === 0,
      sortOrder: count,
    },
  })
  return NextResponse.json(avatar, { status: 201 })
}
