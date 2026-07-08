import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { generateSop, type SopBrief } from '@/lib/sop-ai'
import { logAudit, getIp } from '@/lib/audit'
import { after, NextRequest, NextResponse } from 'next/server'

// AI generation calls Claude — allow up to 60s
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'sops'); if (gate) return gate
  const accountParam = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountParam)

  const sops = await prisma.sop.findMany({
    where: filter,
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true, title: true, industry: true, category: true, source: true, updatedAt: true },
  })
  return NextResponse.json(sops)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'sops'); if (gate) return gate
  const body = await req.json()
  const accountId =
    session.user.role === 'master_admin'
      ? (body.accountId ?? null)
      : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  let data: { title: string; industry: string | null; category: string | null; content: string; source: string }

  if (body.generate) {
    const brief = body.generate as SopBrief
    if (!brief.industry?.trim() || !brief.topic?.trim()) {
      return NextResponse.json({ error: 'Industry and topic are required' }, { status: 400 })
    }
    try {
      const generated = await generateSop(accountId, brief)
      data = { ...generated, industry: brief.industry.trim(), source: 'ai' }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 502 })
    }
  } else {
    if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    data = {
      title: body.title.trim(),
      industry: body.industry?.trim() || null,
      category: body.category?.trim() || null,
      content: typeof body.content === 'string' ? body.content : '',
      source: 'custom',
    }
  }

  const sop = await prisma.sop.create({ data: { ...data, accountId } })

  after(() => logAudit({
    accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'sop.created', entityType: 'sop', entityId: sop.id, entityLabel: sop.title,
    ipAddress: getIp(req),
  }))

  return NextResponse.json(sop, { status: 201 })
}
