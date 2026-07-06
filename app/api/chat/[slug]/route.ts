import { prisma } from '@/lib/prisma'
import { sendPushToAccount } from '@/lib/push'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ slug: string }> }

// Start a conversation from the public widget. Returns a visitor token that
// authenticates all further reads/posts on this thread.
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params

  const ip = getClientIp(req)
  if (!rateLimit(`chat:start:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const account = await prisma.account.findUnique({
    where: { slug, isActive: true },
    select: { id: true, name: true },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // Contact details provided → this is a lead, straight into the pipeline
  let leadId: string | null = null
  if (phone || email) {
    const lead = await prisma.lead.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        source: 'chat',
        status: 'new',
        notes: message ? `Live chat opened with: "${message}"` : null,
        accountId: account.id,
      },
    })
    leadId = lead.id
  }

  const conversation = await prisma.chatConversation.create({
    data: {
      visitorToken: randomBytes(24).toString('hex'),
      visitorName: name,
      visitorPhone: phone || null,
      visitorEmail: email || null,
      leadId,
      accountId: account.id,
      messages: message ? { create: { sender: 'visitor', senderName: name, body: message } } : undefined,
    },
  })

  sendPushToAccount(account.id, {
    title: `💬 New chat: ${name}`,
    body: message || 'Started a live chat on your website',
    url: '/live-chat',
  }).catch(() => {})

  return NextResponse.json({
    conversationId: conversation.id,
    token: conversation.visitorToken,
    businessName: account.name,
  })
}
