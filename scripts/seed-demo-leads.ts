// One-off: seed 20 demo leads into the Velvet Touch account so the Reports
// page has data to show. Every row is tagged in `notes` with the DEMO_TAG
// marker below — see scripts/remove-demo-leads.ts to undo this cleanly.
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.seed.tmp' })

const prisma = new PrismaClient()

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

// Roughly: new < contacted < quoted < won/lost, weighted toward won so the
// funnel looks like a healthy, currently-trading salon.
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

async function main() {
  const account = await prisma.account.findFirst({
    where: { name: { contains: 'Velvet Touch', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true },
  })

  if (!account) {
    throw new Error('No account found matching "Velvet Touch" — aborting without writing anything.')
  }

  console.log(`Seeding into account: ${account.name} (${account.slug}, ${account.id})`)

  const existingDemo = await prisma.lead.count({
    where: { accountId: account.id, notes: { contains: DEMO_TAG } },
  })
  if (existingDemo > 0) {
    throw new Error(
      `${existingDemo} demo leads already exist for this account. Run scripts/remove-demo-leads.ts first if you want to reseed.`
    )
  }

  const shuffledStatus = [...STATUS_PLAN].sort(() => Math.random() - 0.5)

  const rows = NAMES.map((name, i) => {
    const status = shuffledStatus[i]
    const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)]
    const createdAt = daysAgo(Math.floor(Math.random() * 60))
    const [first, last] = name.split(' ')
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`

    // Won leads carry the real service value; lost/open leads carry an
    // estimate so the "value" column isn't empty across the board.
    const value = status === 'won' ? svc.value : status === 'lost' ? null : svc.value

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

  for (const row of rows) {
    await prisma.lead.create({ data: row })
  }

  console.log(`Created ${rows.length} demo leads.`)
  const bySource = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1
    return acc
  }, {})
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  console.log('By source:', bySource)
  console.log('By status:', byStatus)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
