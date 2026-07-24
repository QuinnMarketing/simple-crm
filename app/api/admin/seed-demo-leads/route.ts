// TEMPORARY: one-off endpoint to seed demo leads into an account for a
// reporting demo. Gated by SEED_DEMO_SECRET (set only for this task).
// Delete this route (and the env var) once the seed has run.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEMO_TAG = '[DEMO SEED — safe to delete]'

const NAMES = [
  'Chloe Nguyen', 'Sarah Mitchell', 'Amelia Chen', 'Olivia Ward', 'Isabella Cooper',
  'Emma Wilson', 'Grace Thompson', 'Zoe Patel', 'Ruby Anderson', 'Mia Robertson',
  'Charlotte Baker', 'Ava Richardson', 'Lily Fraser', 'Sophie Turner', 'Ella Simmons',
  'Hannah Reid', 'Matilda Doyle', 'Georgia Blake', 'Freya Osborne', 'Willow Harding',
]

const SOURCES: { source: string; weight: number }[] = [
  { source: 'website', weight: 6 },
  { source: 'google_ads', weight: 5 },
  { source: 'instagram', weight: 4 },
  { source: 'referral', weight: 3 },
  { source: 'facebook_ads', weight: 2 },
]

const SERVICES: { service: string; value: number }[] = [
  { service: 'Balayage & Colour', value: 220 },
  { service: 'Cut & Blow Dry', value: 85 },
  { service: 'Keratin Smoothing Treatment', value: 210 },
  { service: 'Signature Facial', value: 150 },
  { service: 'Brow Lamination & Tint', value: 65 },
  { service: 'Classic Lash Extensions', value: 120 },
  { service: 'Full Leg & Bikini Wax', value: 75 },
  { service: 'Gel Manicure & Pedicure', value: 95 },
  { service: 'Relaxation Massage 60min', value: 130 },
  { service: 'Bridal Makeup Trial', value: 140 },
  { service: "Men's Grooming Package", value: 70 },
  { service: 'Deluxe Pamper Package', value: 215 },
]

const STATUS_PLAN: string[] = [
  'won', 'won', 'won', 'won', 'won', 'won', 'won', 'won',
  'quoted', 'quoted', 'quoted',
  'contacted', 'contacted', 'contacted', 'contacted',
  'new', 'new', 'new',
  'lost', 'lost',
]

function weightedSource(): string {
  const total = SOURCES.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const s of SOURCES) {
    if (r < s.weight) return s.source
    r -= s.weight
  }
  return 'website'
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0)
  return d
}

export async function POST(req: NextRequest) {
  const secret = process.env.SEED_DEMO_SECRET
  const provided = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const account = await prisma.account.findFirst({
    where: { name: { contains: 'Velvet Touch', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true },
  })
  if (!account) {
    return NextResponse.json({ error: 'No account found matching "Velvet Touch"' }, { status: 404 })
  }

  const existingDemo = await prisma.lead.count({
    where: { accountId: account.id, notes: { contains: DEMO_TAG } },
  })
  if (existingDemo > 0) {
    return NextResponse.json(
      { error: `${existingDemo} demo leads already exist for this account`, accountId: account.id },
      { status: 409 }
    )
  }

  const shuffledStatus = [...STATUS_PLAN].sort(() => Math.random() - 0.5)

  const rows = NAMES.map((name, i) => {
    const status = shuffledStatus[i]
    const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)]
    const createdAt = daysAgo(Math.floor(Math.random() * 60))
    const [first, last] = name.split(' ')
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`
    const value = status === 'lost' ? null : svc.value

    return {
      accountId: account.id,
      name,
      email,
      source: weightedSource(),
      status,
      service: svc.service,
      value,
      notes: `${DEMO_TAG} Generated 2026-07-24 to demonstrate the Reports dashboard.`,
      createdAt,
      updatedAt: createdAt,
      ...(status === 'lost' ? { lostReason: 'Went with another salon' } : {}),
    }
  })

  await prisma.lead.createMany({ data: rows })

  const bySource = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1
    return acc
  }, {})
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    ok: true,
    account: { id: account.id, name: account.name, slug: account.slug },
    created: rows.length,
    bySource,
    byStatus,
  })
}
