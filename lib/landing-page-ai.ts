import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'
import type { LandingPageContent } from './landing-page-types'
import { EMPTY_CONTENT, parseContent } from './landing-page-types'
import { searchStockImages } from './stock-images'

export interface LandingPageBrief {
  service: string      // what's being promoted, e.g. "Blocked drain clearing"
  location: string     // suburb / service area
  offer?: string       // e.g. "$99 drain camera inspection"
  goal: 'form' | 'call'
  notes?: string       // anything else the user wants emphasised
}

const CONTENT_TOOL = {
  name: 'generate_landing_page',
  description: 'Generate the complete landing page content',
  input_schema: {
    type: 'object' as const,
    properties: {
      theme: {
        type: 'object',
        properties: { primaryColor: { type: 'string', description: 'Hex accent colour suited to the trade, e.g. #1d4ed8. Never purple.' } },
        required: ['primaryColor'],
      },
      hero: {
        type: 'object',
        properties: {
          badge: { type: 'string', description: 'Short trust line above the headline (licensing, years in business, service area)' },
          headline: { type: 'string', description: 'Benefit-led headline, under 10 words, specific to the service and area' },
          subheadline: { type: 'string', description: '1-2 sentences expanding the promise. Concrete, no fluff.' },
          ctaLabel: { type: 'string', description: 'Button text, action-first, under 5 words' },
        },
        required: ['badge', 'headline', 'subheadline', 'ctaLabel'],
      },
      benefits: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          items: {
            type: 'array',
            description: 'Exactly 3-4 benefits. Specific and provable, not generic ("Upfront fixed pricing" not "Great service").',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, description: { type: 'string' } },
              required: ['title', 'description'],
            },
          },
        },
        required: ['title', 'items'],
      },
      offer: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'true only if the business gave a concrete offer' },
          title: { type: 'string' },
          description: { type: 'string' },
          urgency: { type: 'string', description: 'Honest scarcity/urgency line, or empty string' },
        },
        required: ['enabled', 'title', 'description', 'urgency'],
      },
      faq: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          title: { type: 'string' },
          items: {
            type: 'array',
            description: '3-4 questions a hesitant customer would actually ask (price, timing, guarantees, process)',
            items: {
              type: 'object',
              properties: { question: { type: 'string' }, answer: { type: 'string' } },
              required: ['question', 'answer'],
            },
          },
        },
        required: ['enabled', 'title', 'items'],
      },
      finalCta: {
        type: 'object',
        properties: { headline: { type: 'string' }, ctaLabel: { type: 'string' } },
        required: ['headline', 'ctaLabel'],
      },
      form: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          buttonLabel: { type: 'string', description: 'Specific, low-friction, e.g. "Get My Free Quote" — never "Submit"' },
          fields: {
            type: 'array',
            description: 'Ask for as little as possible: ["name","phone"] plus optionally "message". Only add "email"/"address" if genuinely needed for this service.',
            items: { type: 'string', enum: ['name', 'phone', 'email', 'address', 'message'] },
          },
        },
        required: ['title', 'buttonLabel', 'fields'],
      },
      thankYou: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          message: { type: 'string', description: 'Set response-time expectation and what happens next' },
        },
        required: ['headline', 'message'],
      },
      meta: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'SEO/ad title, under 60 chars' },
          description: { type: 'string', description: 'Meta description, under 155 chars' },
        },
        required: ['title', 'description'],
      },
      imageQuery: {
        type: 'string',
        description: 'A 2-4 word stock photo search phrase showing this trade in action, e.g. "plumber repairing pipes" or "electrician switchboard work". Concrete and visual — no place names, no abstract concepts.',
      },
    },
    required: ['theme', 'hero', 'benefits', 'offer', 'faq', 'finalCta', 'form', 'thankYou', 'meta', 'imageQuery'],
  },
}

export async function generateLandingPageContent(accountId: string, brief: LandingPageBrief): Promise<LandingPageContent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI not configured — ANTHROPIC_API_KEY missing')
  }

  const [account, priceItems, reviews] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true, businessPhone: true, businessAddress: true, businessWebsite: true, abn: true },
    }),
    prisma.priceItem.findMany({
      where: { accountId, active: true },
      select: { name: true, price: true, unit: true, description: true },
      orderBy: { name: 'asc' },
      take: 30,
    }),
    prisma.review.findMany({
      where: { accountId, status: 'approved', rating: { gte: 4 }, body: { not: null } },
      select: { reviewerName: true, rating: true, body: true },
      orderBy: { rating: 'desc' },
      take: 6,
    }),
  ])

  const context = [
    `Business: ${account?.name ?? 'the business'}`,
    account?.businessPhone ? `Phone: ${account.businessPhone}` : '',
    account?.businessAddress ? `Based in: ${account.businessAddress}` : '',
    `\nService being promoted: ${brief.service}`,
    `Service area: ${brief.location}`,
    brief.offer ? `Offer: ${brief.offer}` : 'No specific offer — set offer.enabled to false.',
    `Page goal: ${brief.goal === 'call' ? 'get phone calls (mobile paid-search traffic)' : 'capture lead form submissions'}`,
    brief.notes ? `Additional notes from the business: ${brief.notes}` : '',
    priceItems.length > 0
      ? `\nReal price list (use real prices where relevant, never invent prices):\n${priceItems.map(p => `- ${p.name}: $${p.price.toFixed(2)} per ${p.unit}${p.description ? ` — ${p.description}` : ''}`).join('\n')}`
      : '\nNo price list available — do not state specific prices.',
    reviews.length > 0
      ? `\nReal customer reviews (these will be shown on the page automatically — write copy that complements them):\n${reviews.map(r => `- ${r.reviewerName} (${r.rating}★): "${r.body!.slice(0, 200)}"`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system: `You are a direct-response copywriter for Australian trades and local service businesses. Write landing page copy that converts paid-search and email traffic into enquiries.

Rules:
- Australian English. Plain, confident, specific. No hype words ("amazing", "world-class"), no exclamation marks.
- One page, one goal. Every section drives toward the single call to action.
- Be concrete: real numbers, real timeframes, real guarantees only when the business context supports them. Never fabricate licenses, awards, or statistics.
- Headlines lead with the visitor's problem or outcome, not the business name.
- Assume mobile-first reading: front-load every sentence.`,
    tools: [CONTENT_TOOL],
    tool_choice: { type: 'tool', name: 'generate_landing_page' },
    messages: [{ role: 'user', content: context }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('AI did not return page content')
  }

  // Run through parseContent for defaults, then attach the real reviews —
  // social proof comes from the Reviews model, never from generated text
  const content = parseContent(JSON.stringify(toolUse.input))
  content.reviews = {
    enabled: reviews.length > 0,
    title: 'What our customers say',
    items: reviews.map(r => ({ name: r.reviewerName, rating: r.rating, text: r.body!.slice(0, 300) })),
  }
  if (!content.meta.title) content.meta.title = `${brief.service} — ${account?.name ?? ''}`.trim()

  // Background imagery: topical stock photos behind the hero and closing CTA.
  // Best-effort — no PEXELS_API_KEY (or no results) just means a plain dark hero.
  const imageQuery = (toolUse.input as { imageQuery?: string }).imageQuery || brief.service
  const images = await searchStockImages(imageQuery)
  if (images.length > 0) {
    content.hero.imageOptions = images
    content.hero.backgroundImage = images[0]
    content.finalCta.backgroundImage = images[1] ?? ''
  }

  return { ...EMPTY_CONTENT, ...content }
}
