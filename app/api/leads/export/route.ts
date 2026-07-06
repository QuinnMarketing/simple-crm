import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { toCsv } from '@/lib/csv'
import { NextRequest, NextResponse } from 'next/server'

const COLUMNS = [
  'name', 'email', 'phone', 'bestTimeToContact', 'address', 'company', 'service',
  'status', 'source', 'value', 'notes', 'lostReason', 'pageUrl', 'gclid', 'createdAt',
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const q = searchParams.get('q')
  const company = searchParams.get('company')
  const accountParam = searchParams.get('account')

  const accountFilter = getAccountFilter(session.user, accountParam)

  const leads = await prisma.lead.findMany({
    where: {
      ...accountFilter,
      ...(company ? { companyId: company } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q } }, { email: { contains: q } },
          { phone: { contains: q } }, { service: { contains: q } },
        ],
      } : {}),
    },
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    // Relation includes generate one bind variable per row; Postgres caps
    // prepared statements at 32,767 — keep exports under that
    take: 30_000,
  })

  const rows = leads.map((l) => ({
    name: l.name,
    email: l.email ?? '',
    phone: l.phone ?? '',
    bestTimeToContact: l.bestTimeToContact ?? '',
    address: l.address ?? '',
    company: l.company?.name ?? '',
    service: l.service ?? '',
    status: l.status,
    source: l.source ?? '',
    value: l.value ?? '',
    notes: l.notes ?? '',
    lostReason: l.lostReason ?? '',
    pageUrl: l.pageUrl ?? '',
    gclid: l.gclid ?? '',
    createdAt: l.createdAt.toISOString(),
  }))

  const csv = toCsv(rows, COLUMNS)
  const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
