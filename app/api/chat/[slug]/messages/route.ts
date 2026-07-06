import { prisma } from '@/lib/prisma'
import { sendPushToAccount } from '@/lib/push'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ slug: string }> }

async function getConversation(slug: string, conversationId: string, token: string) {
  if (!conversationId || !token) return null
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { account: { select: { id: true, slug: true } } },
  })
  if (!conversation || conversation.visitorToken !== token || conversation.account?.slug !== slug) return null
  return conversation
}

// Visitor polls their thread
export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const conversationId = req.nextUrl.searchParams.get('conversation') ?? ''
  const token = req.nextUrl.searchParams.get('token') ?? ''

  const conversation = await getConversation(slug, conversationId, token)
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sender: true, senderName: true, body: true, createdAt: true },
  })

  return NextResponse.json({ status: conversation.status, messages })
}

// Visitor sends a message
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params

  const ip = getClientIp(req)
  if (!rateLimit(`chat:msg:${ip}`, 60, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const conversation = await getConversation(slug, body.conversation ?? '', body.token ?? '')
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : ''
  if (!text) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const message = await prisma.chatMessage.create({
    data: { conversationId: conversation.id, sender: 'visitor', senderName: conversation.visitorName, body: text },
  })
  await prisma.chatConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: 'open' }, // visitor reply reopens a closed thread
  })

  if (conversation.accountId) {
    sendPushToAccount(conversation.accountId, {
      title: `💬 ${conversation.visitorName}`,
      body: text.slice(0, 100),
      url: '/live-chat',
    }).catch(() => {})
  }

  return NextResponse.json({ message })
}
