import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireModule(session.user, 'live_chat'); if (gate) return gate
  const accountParam = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountParam)

  const conversations = await prisma.chatConversation.findMany({
    where: filter,
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    select: {
      id: true,
      visitorName: true,
      visitorPhone: true,
      visitorEmail: true,
      status: true,
      leadId: true,
      lastMessageAt: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, sender: true },
      },
      _count: {
        select: { messages: { where: { sender: 'visitor', readByStaff: false } } },
      },
    },
  })

  return NextResponse.json(conversations.map(c => ({
    id: c.id,
    visitorName: c.visitorName,
    visitorPhone: c.visitorPhone,
    visitorEmail: c.visitorEmail,
    status: c.status,
    leadId: c.leadId,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    lastMessage: c.messages[0]?.body ?? '',
    unread: c._count.messages,
  })))
}
