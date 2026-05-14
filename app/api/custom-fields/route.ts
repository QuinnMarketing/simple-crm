import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const accountParam = url.searchParams.get('account')
  const accountFilter = getAccountFilter(session.user, accountParam ?? undefined)

  const fields = await prisma.customField.findMany({
    where: accountFilter,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(fields)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const accountId =
    session.user.role === 'master_admin'
      ? (body.accountId ?? null)
      : (session.user.accountId ?? null)

  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const last = await prisma.customField.findFirst({
    where: { accountId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const field = await prisma.customField.create({
    data: {
      accountId,
      name: body.name.trim(),
      type: body.type ?? 'text',
      options: body.options ? JSON.stringify(body.options) : null,
      required: body.required ?? false,
      order: (last?.order ?? -1) + 1,
    },
  })

  return NextResponse.json(field, { status: 201 })
}
