import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { enrichLeadProfile } from '@/lib/profile-enrichment'
import { logAudit, getIp } from '@/lib/audit'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const lead = await prisma.lead.findFirst({ where: { id, ...filter } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!lead.email) return NextResponse.json({ error: 'This lead has no email address to enrich' }, { status: 400 })
  if (!lead.accountId) return NextResponse.json({ error: 'No account associated with this lead' }, { status: 400 })

  let result
  try {
    result = await enrichLeadProfile(lead.accountId, lead.email)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Enrichment failed' }, { status: 502 })
  }
  if (!result) {
    return NextResponse.json({ error: 'Profile enrichment not configured. Add an Apollo API key in Settings → Integrations.' }, { status: 400 })
  }

  await prisma.lead.update({
    where: { id },
    data: { profileData: JSON.stringify(result), profileEnrichedAt: new Date() },
  })

  after(() => logAudit({
    accountId: lead.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'lead.profile_enriched', entityType: 'lead', entityId: id, entityLabel: lead.name,
    ipAddress: getIp(req),
  }))

  return NextResponse.json({ profileData: result, profileEnrichedAt: new Date().toISOString() })
}
