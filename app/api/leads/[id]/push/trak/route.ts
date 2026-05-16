import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const TRAK_BASE = 'https://app.trak.co/api/v2'

async function trakPost(apiKey: string, path: string, body: Record<string, unknown>) {
  return fetch(`${TRAK_BASE}${path}`, {
    method: 'POST',
    headers: {
      'ttrak-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const { id } = await params

  const integration = await prisma.accountIntegration.findFirst({
    where: { accountId, platform: 'trak', enabled: true },
  })
  if (!integration) return NextResponse.json({ error: 'Trak not configured' }, { status: 404 })

  let apiKey: string
  try {
    const cfg = JSON.parse(integration.config) as Record<string, string>
    apiKey = cfg.apiKey
    if (!apiKey) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Trak API key not set' }, { status: 422 })
  }

  const lead = await prisma.lead.findFirst({ where: { id, accountId } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const nameParts = lead.name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

  // Step 1: Create contact
  const contactRes = await trakPost(apiKey, '/contacts', {
    firstName,
    lastName,
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
  })

  let contactId: string | null = null
  if (contactRes.ok) {
    try {
      const data = await contactRes.json() as Record<string, unknown>
      const inner = data.data as Record<string, unknown> | undefined
      contactId = ((data.id ?? data.contactId ?? inner?.id) as string | undefined) ?? null
    } catch { /* ok */ }
  } else {
    const text = await contactRes.text().catch(() => '')
    return NextResponse.json(
      { error: `Trak contact creation failed (${contactRes.status})`, detail: text },
      { status: 502 }
    )
  }

  // Step 2: Create job
  const descParts: string[] = []
  if (lead.service) descParts.push(lead.service)
  if (lead.notes) descParts.push(lead.notes)
  if (lead.source) descParts.push(`Source: ${lead.source}`)
  const description = descParts.join('\n\n') || 'New lead from CRM'

  const jobBody: Record<string, unknown> = {
    title: lead.service?.slice(0, 200) ?? lead.name,
    description,
    address: lead.address,
    status: 'quote',
  }
  if (contactId) jobBody.contactId = contactId

  const jobRes = await trakPost(apiKey, '/jobs', jobBody)

  if (!jobRes.ok) {
    const text = await jobRes.text().catch(() => '')
    return NextResponse.json(
      { error: `Trak job creation failed (${jobRes.status})`, detail: text },
      { status: 502 }
    )
  }

  let jobId: string | null = null
  try {
    const data = await jobRes.json() as Record<string, unknown>
    const inner = data.data as Record<string, unknown> | undefined
    jobId = ((data.id ?? data.jobId ?? inner?.id) as string | undefined) ?? null
  } catch { /* ok */ }

  return NextResponse.json({ ok: true, contactId, jobId })
}
