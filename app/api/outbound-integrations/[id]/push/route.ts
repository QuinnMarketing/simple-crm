import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const { id } = await params
  const integration = await prisma.outboundIntegration.findFirst({
    where: { id, accountId, enabled: true },
  })
  if (!integration) return NextResponse.json({ error: 'Integration not found or disabled' }, { status: 404 })

  const { leadId } = await req.json()
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, accountId },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const origin = req.nextUrl.origin
  const payload = {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
    service: lead.service,
    notes: lead.notes,
    source: lead.source,
    status: lead.status,
    value: lead.value,
    gclid: lead.gclid,
    fbclid: lead.fbclid,
    utm_source: lead.utmSource,
    utm_medium: lead.utmMedium,
    utm_campaign: lead.utmCampaign,
    utm_term: lead.utmTerm,
    utm_content: lead.utmContent,
    utm_matchtype: lead.utmMatchtype,
    page_url: lead.pageUrl,
    ip_address: lead.ipAddress,
    created_at: lead.createdAt,
    crm_lead_url: `${origin}/leads/${lead.id}`,
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (integration.authType === 'bearer' && integration.authValue) {
    headers['Authorization'] = `Bearer ${integration.authValue}`
  } else if (integration.authType === 'api_key' && integration.authHeader && integration.authValue) {
    headers[integration.authHeader] = integration.authValue
  } else if (integration.authType === 'basic' && integration.authValue) {
    headers['Authorization'] = `Basic ${Buffer.from(integration.authValue).toString('base64')}`
  }

  let status: number
  let responseBody: string

  try {
    const res = await fetch(integration.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    status = res.status
    responseBody = await res.text().catch(() => '')
  } catch (err) {
    return NextResponse.json(
      { error: `Push failed: ${err instanceof Error ? err.message : 'Network error'}` },
      { status: 502 }
    )
  }

  if (status >= 200 && status < 300) {
    return NextResponse.json({ ok: true, status, response: responseBody })
  }

  return NextResponse.json(
    { error: `Endpoint returned ${status}`, response: responseBody },
    { status: 502 }
  )
}
