import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured — add ANTHROPIC_API_KEY to environment variables' }, { status: 400 })

  const body = await req.json()
  const { prompt, leadName, leadService, leadNotes, leadAddress, type, accountParam } = body
  if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

  const rawFilter = getAccountFilter(session.user, accountParam)
  const accountId = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null

  let priceBookContext = ''
  if (accountId) {
    const items = await prisma.priceItem.findMany({
      where: { accountId, active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { name: true, description: true, price: true, unit: true, category: true, sku: true },
    })
    if (items.length > 0) {
      priceBookContext = '\n\nAvailable price book items (use these prices where applicable):\n' +
        items.map(i =>
          `- ${i.name}${i.sku ? ` [${i.sku}]` : ''}${i.category ? ` (${i.category})` : ''}: $${i.price.toFixed(2)} per ${i.unit}${i.description ? ` — ${i.description}` : ''}`
        ).join('\n')
    }
  }

  const userContent = [
    `Generate line items for a ${type === 'invoice' ? 'tax invoice' : 'quote'} for the following job:`,
    leadName ? `Client: ${leadName}` : '',
    leadService ? `Service type: ${leadService}` : '',
    leadAddress ? `Location: ${leadAddress}` : '',
    leadNotes ? `Lead notes: ${leadNotes}` : '',
    `\nJob description:\n${prompt.trim()}`,
    priceBookContext,
  ].filter(Boolean).join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are a professional quote and invoice generator for a service business in Australia. Generate accurate, professional line items based on the job description. Use price book items when they match the work. All prices are in AUD excluding GST. Keep descriptions concise and professional. Quantities should be realistic.`,
    tools: [
      {
        name: 'generate_line_items',
        description: 'Generate structured quote/invoice line items',
        input_schema: {
          type: 'object' as const,
          properties: {
            lineItems: {
              type: 'array',
              description: 'Line items for the quote or invoice',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string', description: 'Clear, professional line item description' },
                  quantity: { type: 'number', description: 'Quantity (e.g. hours, units)' },
                  unitPrice: { type: 'number', description: 'Price per unit in AUD excluding GST' },
                },
                required: ['description', 'quantity', 'unitPrice'],
              },
            },
            notes: {
              type: 'string',
              description: 'Optional professional notes, payment terms, or conditions for the document',
            },
          },
          required: ['lineItems'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'generate_line_items' },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'AI did not return structured line items' }, { status: 500 })
  }

  const result = toolUse.input as { lineItems: { description: string; quantity: number; unitPrice: number }[]; notes?: string }
  return NextResponse.json(result)
}
