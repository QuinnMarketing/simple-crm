import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountId, enabled, title, description, autoApprove, autoReply, replyTemplates } = body

  if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

  const user = session.user
  if (user.role !== 'master_admin') {
    const ids = user.accountIds?.length ? user.accountIds : (user.accountId ? [user.accountId] : [])
    if (!ids.includes(accountId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = {
    enabled: Boolean(enabled),
    title: String(title ?? 'How was your experience?').trim().slice(0, 120),
    description: description ? String(description).slice(0, 500) : null,
    autoApprove: Boolean(autoApprove),
    autoReply: Boolean(autoReply),
    replyTemplates: String(replyTemplates ?? '{}'),
  }

  await prisma.reviewSettings.upsert({
    where: { accountId },
    create: { accountId, ...data },
    update: data,
  })

  return NextResponse.json({ success: true })
}
