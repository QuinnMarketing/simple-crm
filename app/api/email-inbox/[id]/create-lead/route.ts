import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { runAutomations } from '@/lib/automations'
import { sendPushToAccount } from '@/lib/push'
import { logAudit, getIp } from '@/lib/audit'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const accountId = typeof filter.accountId === 'string' ? filter.accountId : null
  if (!accountId) return NextResponse.json({ error: 'Account not found' }, { status: 400 })

  const email = await prisma.syncedEmail.findFirst({ where: { id, accountId } })
  if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (email.leadId) return NextResponse.json({ error: 'Already linked to a lead' }, { status: 400 })

  const lead = await prisma.lead.create({
    data: {
      name: email.fromName || email.fromEmail,
      email: email.fromEmail,
      source: email.provider,
      status: 'new',
      notes: email.subject ? `${email.subject}\n\n${email.snippet}` : email.snippet,
      accountId,
    },
  })

  await prisma.syncedEmail.update({ where: { id }, data: { leadId: lead.id } })

  after(() => runAutomations('lead_created', lead))
  after(() => sendPushToAccount(accountId, {
    title: `New Lead: ${lead.name}`,
    body: [lead.email, 'Email inbox'].filter(Boolean).join(' · '),
    url: `/leads/${lead.id}`,
  }))
  after(() => logAudit({
    accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'lead.created', entityType: 'lead', entityId: lead.id, entityLabel: lead.name,
    ipAddress: getIp(req),
  }))

  return NextResponse.json({ lead })
}
