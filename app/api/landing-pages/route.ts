import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { generateLandingPageContent, type LandingPageBrief } from '@/lib/landing-page-ai'
import { logAudit, getIp } from '@/lib/audit'
import { randomBytes } from 'crypto'
import { after, NextRequest, NextResponse } from 'next/server'

// Generation calls Claude with account context — allow up to 60s
export const maxDuration = 60

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `${base || 'page'}-${randomBytes(3).toString('hex')}`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountParam = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountParam)

  const pages = await prisma.landingPage.findMany({
    where: filter,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, slug: true, status: true, goal: true, views: true, createdAt: true, updatedAt: true },
  })

  // Conversion counts: leads whose captured pageUrl points at this page
  const leadCounts = await Promise.all(
    pages.map(p => prisma.lead.count({ where: { pageUrl: { contains: `/lp/${p.slug}` } } }))
  )

  return NextResponse.json(pages.map((p, i) => ({ ...p, leads: leadCounts[i] })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const accountId =
    session.user.role === 'master_admin'
      ? (body.accountId ?? null)
      : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  const brief = body.brief as LandingPageBrief | undefined
  if (!brief?.service?.trim() || !brief?.location?.trim()) {
    return NextResponse.json({ error: 'Service and location are required' }, { status: 400 })
  }
  const goal = brief.goal === 'call' ? 'call' : 'form'

  let content
  try {
    content = await generateLandingPageContent(accountId, { ...brief, goal })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 502 })
  }

  const name = body.name?.trim() || `${brief.service} — ${brief.location}`
  const page = await prisma.landingPage.create({
    data: {
      name,
      slug: slugify(name),
      goal,
      content: JSON.stringify(content),
      accountId,
    },
  })

  after(() => logAudit({
    accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'landing_page.created', entityType: 'landing_page', entityId: page.id, entityLabel: page.name,
    ipAddress: getIp(req),
  }))

  return NextResponse.json(page, { status: 201 })
}
