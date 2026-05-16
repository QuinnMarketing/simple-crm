import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountParam, rows } = body

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account required' }, { status: 400 })
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'No rows' }, { status: 400 })

  const data = (rows as Record<string, string>[])
    .filter(r => r.name?.trim() && !isNaN(parseFloat(r.price)))
    .map(r => ({
      accountId,
      name: String(r.name).trim().slice(0, 200),
      description: r.description?.trim() ? String(r.description).slice(0, 1000) : null,
      price: parseFloat(r.price),
      unit: r.unit?.trim() ? String(r.unit).slice(0, 50) : 'each',
      category: r.category?.trim() ? String(r.category).trim().slice(0, 100) : null,
      sku: r.sku?.trim() ? String(r.sku).trim().slice(0, 100) : null,
      active: r.active !== undefined ? String(r.active).toLowerCase() !== 'false' : true,
    }))

  if (data.length === 0) return NextResponse.json({ error: 'No valid rows — ensure name and price columns are present' }, { status: 400 })

  await prisma.priceItem.createMany({ data })
  return NextResponse.json({ count: data.length }, { status: 201 })
}
