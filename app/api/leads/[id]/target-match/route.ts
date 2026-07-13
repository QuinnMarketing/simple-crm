import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { getPrimaryAvatar, personaContextBlock } from '@/lib/customer-avatar-ai'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const SCORE_TOOL = {
  name: 'score_lead_match',
  description: 'Score how well this lead matches the target customer',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: { type: 'number', description: '0-100. 80+ strong match, 50-79 partial, below 50 weak.' },
      summary: { type: 'string', description: 'One sentence: why, and what to emphasise when contacting them.' },
    },
    required: ['score', 'summary'],
  },
}

// On-demand (button-triggered, not per-webhook — junk leads would burn tokens)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 502 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const lead = await prisma.lead.findFirst({ where: { id, ...filter } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!lead.accountId) return NextResponse.json({ error: 'Lead has no account' }, { status: 400 })

  const persona = await getPrimaryAvatar(lead.accountId)
  if (!persona) return NextResponse.json({ error: 'Define a Target Customer first (Target Customer page)' }, { status: 400 })

  const context = [
    personaContextBlock(persona),
    `\nLEAD to score against that target customer:`,
    `- Name: ${lead.name}`,
    lead.service ? `- Service requested: ${lead.service}` : '',
    lead.address ? `- Address: ${lead.address}` : '',
    lead.source ? `- Source: ${lead.source}` : '',
    lead.value ? `- Estimated value: $${lead.value}` : '',
    lead.notes ? `- Notes: ${lead.notes.slice(0, 500)}` : '',
  ].filter(Boolean).join('\n')

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      system: 'You score sales leads against a business\'s ideal-customer persona. Be honest — a weak match should score low. Base the score only on the evidence given; missing information caps the score around 60.',
      tools: [SCORE_TOOL],
      tool_choice: { type: 'tool', name: 'score_lead_match' },
      messages: [{ role: 'user', content: context }],
    })
    const toolUse = message.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') throw new Error('No score returned')
    const r = toolUse.input as { score?: number; summary?: string }
    const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)))
    const summary = String(r.summary ?? '').slice(0, 300)

    const updated = await prisma.lead.update({
      where: { id },
      data: { targetMatchScore: score, targetMatchSummary: summary, targetMatchAt: new Date() },
      select: { targetMatchScore: true, targetMatchSummary: true, targetMatchAt: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Scoring failed' }, { status: 502 })
  }
}
