import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'

export interface SopBrief {
  industry: string   // e.g. "Plumbing" — preset or free text
  topic: string      // the process to document, e.g. "Emergency callout response"
  notes?: string     // business-specific requirements to bake in
}

// Suggested SOP topics per industry — shown as quick-picks in the UI.
// Exported so the frontend and any future automation share one list.
export const INDUSTRY_SOP_SUGGESTIONS: Record<string, string[]> = {
  Plumbing: ['Emergency callout response', 'Hot water system installation', 'Blocked drain procedure', 'Quoting and invoicing process'],
  Electrical: ['Safety testing and tagging', 'Switchboard upgrade procedure', 'New job compliance checklist', 'Certificate of compliance process'],
  'HVAC / Air Conditioning': ['Split system installation', 'Preventative maintenance visit', 'Refrigerant handling procedure', 'Warranty claim process'],
  'Building / Renovation': ['Site setup and safety induction', 'Variation and change order process', 'Handover and defect inspection', 'Subcontractor onboarding'],
  Landscaping: ['New garden installation workflow', 'Maintenance round procedure', 'Quoting site visits', 'Equipment maintenance schedule'],
  Cleaning: ['End of lease clean checklist', 'New client onboarding', 'Chemical handling and safety', 'Quality inspection process'],
  Painting: ['Surface preparation standards', 'Interior repaint workflow', 'Colour consultation process', 'Final walkthrough checklist'],
  Roofing: ['Roof inspection procedure', 'Working at heights safety', 'Leak detection and repair', 'Insurance claim documentation'],
  General: ['New lead response process', 'Customer complaint handling', 'Invoice follow-up and collections', 'New employee onboarding'],
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
