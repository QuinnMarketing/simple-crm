import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { runAutomations } from '@/lib/automations'
import { logAudit, getIp } from '@/lib/audit'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// Convert a chat conversation into a lead (for chats where the visitor
// didn't leave contact details at the start, so no lead was auto-created)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const conversation = await prisma.chatConversation.findFirst({
    where: { id, ...filter },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 10, where: { sender: 'visitor' } } },
  })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (conversation.leadId) return NextResponse.json({ error: 'Already linked to a lead' }, { status: 400 })
  if (!conversation.accountId) return NextResponse.json({ error: 'No account on this conversation' }, { status: 400 })

  const transcript = conversation.messages.map(m => `"${m.body}"`).join('\n')
  const lead = await prisma.lead.create({
    data: {
      name: conversation.visitorName,
      phone: conversation.visitorPhone,
      email: conversation.visitorEmail,
      source: 'chat',
      status: 'new',
      notes: transcript ? `From live chat:\n${transcript}` : 'Created from live chat',
      accountId: conversation.accountId,
    },
  })

  await prisma.chatConversation.update({ where: { id }, data: { leadId: lead.id } })

  after(() => runAutomations('lead_created', lead))
  after(() => logAudit({
    accountId: conversation.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'lead.created', entityType: 'lead', entityId: lead.id, entityLabel: lead.name,
    ipAddress: getIp(req),
  }))

  return NextResponse.json({ lead })
}
