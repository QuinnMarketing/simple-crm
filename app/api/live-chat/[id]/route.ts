import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// GET — full thread (marks visitor messages as read)
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const conversation = await prisma.chatConversation.findFirst({
    where: { id, ...filter },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.chatMessage.updateMany({
    where: { conversationId: id, sender: 'visitor', readByStaff: false },
    data: { readByStaff: true },
  })

  return NextResponse.json(conversation)
}

// POST — staff reply
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const conversation = await prisma.chatConversation.findFirst({ where: { id, ...filter } })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : ''
  if (!text) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      sender: 'staff',
      senderName: session.user.name ?? session.user.email ?? 'Staff',
      body: text,
      readByStaff: true,
    },
  })
  await prisma.chatConversation.update({
    where: { id },
    data: { lastMessageAt: new Date(), status: 'open' },
  })

  return NextResponse.json({ message })
}

// PATCH — close / reopen
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const conversation = await prisma.chatConversation.findFirst({ where: { id, ...filter } })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (!['open', 'closed'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updated = await prisma.chatConversation.update({ where: { id }, data: { status: body.status } })
  return NextResponse.json(updated)
}
