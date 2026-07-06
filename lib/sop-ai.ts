import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'

export interface SopBrief {
  industry: string   // e.g. "Plumbing" — preset or free text
  topic: string      // the process to document, e.g. "Emergency callout response"
  notes?: string     // business-specific requirements to bake in
}

const SOP_TOOL = {
  name: 'generate_sop',
  description: 'Generate a structured standard operating procedure document',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Clear SOP title, e.g. "SOP: Emergency Callout Response"' },
      category: { type: 'string', enum: ['Safety', 'Operations', 'Sales', 'Admin', 'Quality'], description: 'Best-fit category' },
      content: {
        type: 'string',
        description: `The full SOP in markdown. Structure:
# <title>
**Purpose** — one paragraph
**Applies to** — who follows this
## Before you start
- prerequisites, tools, safety gear
## Procedure
1. numbered steps, each specific and actionable (include what "done" looks like)
## Safety requirements
- concrete hazards and controls for this task (omit section if genuinely none)
## Quality checks
- how to verify the job was done right
## Common mistakes
- the 2-4 errors that actually happen, and how to avoid them`,
      },
    },
    required: ['title', 'category', 'content'],
  },
}

export async function generateSop(accountId: string, brief: SopBrief): Promise<{ title: string; category: string; content: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI not configured — ANTHROPIC_API_KEY missing')
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true, businessAddress: true },
  })

  const context = [
    `Business: ${account?.name ?? 'a trades business'}${account?.businessAddress ? ` (${account.businessAddress})` : ''}`,
    `Industry: ${brief.industry}`,
    `Process to document: ${brief.topic}`,
    brief.notes ? `Business-specific requirements to incorporate: ${brief.notes}` : '',
  ].filter(Boolean).join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system: `You write standard operating procedures for small Australian trades and service businesses. The reader is a field worker or office staff member, often reading on a phone — write for them, not for a compliance auditor.

Rules:
- Australian English, plain language, short sentences. No corporate filler.
- Every step must be specific enough that a new hire could follow it without asking questions.
- Reference Australian standards/regulations only where genuinely applicable and well-known (e.g. AS/NZS 3000 for electrical) — never invent regulation numbers.
- Safety content must be practical and task-specific, not generic boilerplate.
- Keep the whole document scannable: a tradesperson should absorb it in under 3 minutes.`,
    tools: [SOP_TOOL],
    tool_choice: { type: 'tool', name: 'generate_sop' },
    messages: [{ role: 'user', content: context }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('AI did not return an SOP')
  }
  const result = toolUse.input as { title: string; category: string; content: string }
  if (!result.title || !result.content) throw new Error('AI returned an incomplete SOP')
  return result
}
