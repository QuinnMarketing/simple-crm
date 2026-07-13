import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { getPrimaryAvatar, personaContextBlock } from '@/lib/customer-avatar-ai'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const DRAFT_TOOL = {
  name: 'draft_campaign_email',
  description: 'Draft the marketing email',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject: { type: 'string', description: 'Subject line under 60 chars. May use {{name}}.' },
      bodyHtml: { type: 'string', description: 'Email body as simple HTML (p, strong, a, ul/li only — the app wraps it in its own template). Use {{name}} for the recipient and {{business_name}} for the sender. 120-220 words.' },
      bodyText: { type: 'string', description: 'Plain-text version of the same email.' },
    },
    required: ['subject', 'bodyHtml', 'bodyText'],
  },
}

// Drafts campaign copy aimed squarely at the account's target customer.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'campaigns'); if (gate) return gate
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 502 })

  const body = await req.json().catch(() => ({}))
  const accountId =
    session.user.role === 'master_admin' ? (body.accountId ?? null) : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  const goal = typeof body.goal === 'string' && body.goal.trim() ? body.goal.trim().slice(0, 400) : 'Re-engage past leads and generate enquiries'

  const [account, persona] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true, businessPhone: true, businessAddress: true } }),
    getPrimaryAvatar(accountId),
  ])

  const context = [
    `Business: ${account?.name ?? 'the business'}`,
    account?.businessAddress ? `Based in: ${account.businessAddress}` : '',
    `Campaign goal (from the owner): ${goal}`,
    personaContextBlock(persona) || '\nNo target-customer persona defined — write for typical local-service customers.',
  ].filter(Boolean).join('\n')

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: `You write marketing emails for Australian trades and local service businesses. Plain, warm, specific — like a good tradie who writes well. No hype words, no exclamation marks, no spam-trigger phrasing. One clear call to action. Speak directly to the target customer's pains and goals when given.`,
      tools: [DRAFT_TOOL],
      tool_choice: { type: 'tool', name: 'draft_campaign_email' },
      messages: [{ role: 'user', content: context }],
    })
    const toolUse = message.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') throw new Error('AI returned no draft')
    const d = toolUse.input as { subject?: string; bodyHtml?: string; bodyText?: string }
    return NextResponse.json({
      subject: String(d.subject ?? ''),
      bodyHtml: String(d.bodyHtml ?? ''),
      bodyText: String(d.bodyText ?? ''),
      targeted: !!persona,
      personaName: persona?.name ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Draft failed' }, { status: 502 })
  }
}
