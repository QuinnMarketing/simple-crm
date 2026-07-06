import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { getWhatsAppConfig, sendWhatsAppText, normalizeWaNumber } from '@/lib/whatsapp'
import { logAudit, getIp } from '@/lib/audit'
import { after, NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// GET — connection status + message thread for this lead
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const lead = await prisma.lead.findFirst({ where: { id, ...filter }, select: { accountId: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = lead.accountId ? await getWhatsAppConfig(lead.accountId) : null
  const messages = await prisma.whatsAppMessage.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ connected: !!config, messages })
}

// POST — send a freeform text message to this lead
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const lead = await prisma.lead.findFirst({ where: { id, ...filter } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!lead.phone) return NextResponse.json({ error: 'This lead has no phone number' }, { status: 400 })
  if (!lead.accountId) return NextResponse.json({ error: 'No account associated with this lead' }, { status: 400 })

  const config = await getWhatsAppConfig(lead.accountId)
  if (!config) {
    return NextResponse.json({ error: 'WhatsApp not connected. Set it up in Settings → Integrations.' }, { status: 400 })
  }

  const { body } = await req.json() as { body?: string }
  if (!body?.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

  const result = await sendWhatsAppText(config, normalizeWaNumber(lead.phone), body.trim())

  const record = await prisma.whatsAppMessage.create({
    data: {
      direction: 'outbound',
      body: body.trim(),
      waMessageId: result.waMessageId ?? null,
      status: result.error ? 'failed' : 'sent',
      error: result.error ?? null,
      leadId: id,
      accountId: lead.accountId,
    },
  })

  if (result.error) {
    return NextResponse.json({ error: result.error, message: record }, { status: 502 })
  }

  after(() => logAudit({
    accountId: lead.accountId, userId: session.user.id, userEmail: session.user.email,
    action: 'lead.whatsapp_sent', entityType: 'lead', entityId: id, entityLabel: lead.name,
    ipAddress: getIp(req),
  }))

  return NextResponse.json({ message: record })
}
