import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const lead = await prisma.lead.findFirst({ where: { id, ...filter }, select: { id: true, accountId: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [fields, values] = await Promise.all([
    prisma.customField.findMany({
      where: { accountId: lead.accountId ?? undefined },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.customFieldValue.findMany({
      where: { leadId: id },
      select: { customFieldId: true, value: true },
    }),
  ])

  const valueMap = Object.fromEntries(values.map((v) => [v.customFieldId, v.value]))

  return NextResponse.json(
    fields.map((f) => ({
      ...f,
      options: f.options ? JSON.parse(f.options) : [],
      value: valueMap[f.id] ?? null,
    }))
  )
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const lead = await prisma.lead.findFirst({ where: { id, ...filter }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // body: { [customFieldId]: value }
  const body: Record<string, string | null> = await req.json()

  await Promise.all(
    Object.entries(body).map(([customFieldId, value]) =>
      prisma.customFieldValue.upsert({
        where: { leadId_customFieldId: { leadId: id, customFieldId } },
        update: { value: value || null },
        create: { leadId: id, customFieldId, value: value || null },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
