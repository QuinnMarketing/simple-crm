import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'

// The shape returned to callers — string fields ready to persist on CustomerAvatar
export interface GeneratedAvatar {
  name: string
  tagline: string
  ageRange: string
  gender: string
  occupation: string
  location: string
  income: string
  goals: string       // newline-separated
  painPoints: string  // newline-separated
  objections: string  // newline-separated
  channels: string    // newline-separated
  services: string    // newline-separated
}

const AVATAR_TOOL = {
  name: 'define_ideal_customer',
  description: 'Define the single ideal customer persona this business should be targeting',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'A memorable persona name pairing a trait with a first name, e.g. "Renovator Rachel" or "Time-poor Tom".' },
      tagline: { type: 'string', description: 'One sentence capturing who they are and why they buy.' },
      ageRange: { type: 'string', description: 'e.g. "35-50"' },
      gender: { type: 'string', description: 'The most representative gender for this persona, or "Any".' },
      occupation: { type: 'string', description: 'Their job / life situation, e.g. "Working parent, owns a 3-bedroom home".' },
      location: { type: 'string', description: 'Where they live relative to the business service area.' },
      income: { type: 'string', description: 'Household income or budget band relevant to the services, e.g. "$120k+ household, comfortable spending on quality".' },
      goals: { type: 'array', items: { type: 'string' }, description: '3-4 concrete things this customer wants to achieve.' },
      painPoints: { type: 'array', items: { type: 'string' }, description: '3-4 specific frustrations/problems the business solves for them.' },
      objections: { type: 'array', items: { type: 'string' }, description: '2-3 reasons they hesitate before buying (price, trust, timing).' },
      channels: { type: 'array', items: { type: 'string' }, description: '3-4 concrete places/ways to reach them (e.g. "Facebook local community groups", "Google search for emergency + suburb").' },
      services: { type: 'array', items: { type: 'string' }, description: 'Which of the business\'s services this customer most needs.' },
    },
    required: ['name', 'tagline', 'ageRange', 'gender', 'occupation', 'location', 'income', 'goals', 'painPoints', 'objections', 'channels', 'services'],
  },
}

// Owner-supplied answers from onboarding (or the page) — free text, optional.
// Essential for brand-new accounts that have no price book or won deals yet.
export interface AvatarHints {
  bestCustomer?: string   // "describe your best customer"
  topServices?: string    // "which services make you the most money"
  serviceArea?: string    // "what areas do you serve"
  idealJobValue?: string  // "what's a great job worth"
  avoid?: string          // "who do you NOT want as a customer"
}

export async function generateCustomerAvatar(accountId: string, hints?: AvatarHints): Promise<GeneratedAvatar> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI not configured — ANTHROPIC_API_KEY missing')
  }

  const [account, priceItems, wonLeads] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true, businessAddress: true, businessWebsite: true, abn: true },
    }),
    prisma.priceItem.findMany({
      where: { accountId, active: true },
      select: { name: true, price: true, unit: true },
      orderBy: { name: 'asc' },
      take: 30,
    }),
    prisma.lead.findMany({
      where: { accountId, status: 'won' },
      select: { service: true, address: true, value: true, source: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const context = [
    `Business: ${account?.name ?? 'the business'}`,
    account?.businessAddress ? `Based in / serves: ${account.businessAddress}` : '',
    account?.businessWebsite ? `Website: ${account.businessWebsite}` : '',
    priceItems.length > 0
      ? `\nServices offered (with prices):\n${priceItems.map(p => `- ${p.name}: $${p.price.toFixed(0)} per ${p.unit}`).join('\n')}`
      : '\nNo price list available.',
    wonLeads.length > 0
      ? `\nReal won customers (patterns to learn from — services bought, area, deal size):\n${wonLeads.map(l => `- ${l.service ?? 'service'}${l.address ? `, ${l.address}` : ''}${l.value ? `, $${l.value.toFixed(0)}` : ''}${l.source ? `, via ${l.source}` : ''}`).join('\n')}`
      : '\nNo won deals recorded yet — infer the ideal customer from the services and location.',
    hints && Object.values(hints).some(Boolean)
      ? `\nThe owner's own words (weight these heavily — they know their market):${hints.bestCustomer ? `\n- Their best customer: "${hints.bestCustomer}"` : ''}${hints.topServices ? `\n- Most profitable services: "${hints.topServices}"` : ''}${hints.serviceArea ? `\n- Service area: "${hints.serviceArea}"` : ''}${hints.idealJobValue ? `\n- A great job is worth: "${hints.idealJobValue}"` : ''}${hints.avoid ? `\n- Customers they DON'T want: "${hints.avoid}"` : ''}`
      : '',
  ].filter(Boolean).join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: `You are a marketing strategist for Australian trades and local service businesses. Define the SINGLE most valuable ideal-customer persona this business should target — the customer who is easiest to win, best to serve, and most profitable.

Rules:
- Australian context and English. Be specific and grounded in THIS business's actual services, prices, location and (if given) real won customers. Never generic.
- The persona is a real archetype the owner can picture and target, not a demographic table.
- Pains and goals must map to the services the business actually sells.
- Channels must be concrete and actionable for a small local business.`,
    tools: [AVATAR_TOOL],
    tool_choice: { type: 'tool', name: 'define_ideal_customer' },
    messages: [{ role: 'user', content: context }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('AI did not return a persona')
  }
  const p = toolUse.input as Record<string, unknown>
  const arr = (v: unknown): string => Array.isArray(v) ? v.filter(Boolean).join('\n') : String(v ?? '')

  return {
    name: String(p.name || 'Your Ideal Customer'),
    tagline: String(p.tagline || ''),
    ageRange: String(p.ageRange || ''),
    gender: String(p.gender || ''),
    occupation: String(p.occupation || ''),
    location: String(p.location || ''),
    income: String(p.income || ''),
    goals: arr(p.goals),
    painPoints: arr(p.painPoints),
    objections: arr(p.objections),
    channels: arr(p.channels),
    services: arr(p.services),
  }
}

// ---------------------------------------------------------------------------
// Shared: feed the primary persona into other AI features (landing pages,
// campaign copy, lead scoring) so everything the CRM writes targets the same
// ideal customer.

export type PersonaRecord = {
  name: string
  tagline: string | null
  ageRange: string | null
  gender: string | null
  occupation: string | null
  location: string | null
  income: string | null
  goals: string | null
  painPoints: string | null
  objections: string | null
  channels: string | null
  services: string | null
}

export async function getPrimaryAvatar(accountId: string): Promise<PersonaRecord | null> {
  return (
    (await prisma.customerAvatar.findFirst({ where: { accountId, isPrimary: true } })) ??
    (await prisma.customerAvatar.findFirst({ where: { accountId }, orderBy: { createdAt: 'asc' } }))
  )
}

/** A compact prompt block describing the persona, or '' when none exists. */
export function personaContextBlock(p: PersonaRecord | null): string {
  if (!p) return ''
  const field = (label: string, v: string | null) => (v ? `- ${label}: ${v.replace(/\n/g, '; ')}` : '')
  return [
    `\nTARGET CUSTOMER (write for this specific person — their language, their worries):`,
    `- Persona: ${p.name}${p.tagline ? ` — ${p.tagline}` : ''}`,
    field('Profile', [p.ageRange, p.gender, p.occupation, p.location, p.income].filter(Boolean).join(', ') || null),
    field('They want', p.goals),
    field('Their pains', p.painPoints),
    field('Their objections (pre-empt these)', p.objections),
    field('Services they need', p.services),
  ].filter(Boolean).join('\n')
}
