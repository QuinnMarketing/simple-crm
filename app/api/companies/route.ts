import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountParam = req.nextUrl.searchParams.get('account')
  const accountFilter = getAccountFilter(session.user, accountParam)

  const companies = await prisma.company.findMany({
    where: accountFilter,
    orderBy: { name: 'asc' },
    include: { _count: { select: { leads: true } } },
  })

  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, color } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const accountId =
    session.user.role === 'master_admin'
      ? (body.accountId ?? null)
      : (session.user.accountId ?? null)

  const company = await prisma.company.create({
    data: { name: name.trim(), color: color ?? '#6366f1', accountId },
    include: { _count: { select: { leads: true } } },
  })

  return NextResponse.json(company, { status: 201 })
}
