import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const SM8_BASE = 'https://api.servicem8.com/api_1.0'

async function sm8Post(path: string, apiKey: string, body: Record<string, string | null>) {
  const res = await fetch(`${SM8_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  })
  return res
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const { id } = await params

  const integration = await prisma.accountIntegration.findFirst({
    where: { accountId, platform: 'servicem8', enabled: true },
  })
  if (!integration) return NextResponse.json({ error: 'ServiceM8 not configured' }, { status: 404 })

  let apiKey: string
  try {
    const cfg = JSON.parse(integration.config) as Record<string, string>
    apiKey = cfg.apiKey
    if (!apiKey) throw new Error('missing')
  } catch {
    return NextResponse.json({ error: 'ServiceM8 API key not set' }, { status: 422 })
  }

  const lead = await prisma.lead.findFirst({ where: { id, accountId } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Split name into first/last best-effort
  const nameParts = lead.name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

  // Step 1: Create client/company
  const companyRes = await sm8Post('/company.json', apiKey, {
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
  })

  if (!companyRes.ok) {
    const text = await companyRes.text().catch(() => '')
    return NextResponse.json({ error: `ServiceM8 company creation failed (${companyRes.status})`, detail: text }, { status: 502 })
  }

  const companyUuid = companyRes.headers.get('x-record-uuid')

  // Step 2: Build job description from service + notes
  const descriptionParts: string[] = []
  if (lead.service) descriptionParts.push(lead.service)
  if (lead.notes) descriptionParts.push(lead.notes)
  const jobDescription = descriptionParts.join('\n\n') || `Lead from ${lead.source ?? 'CRM'}`

  // Step 3: Create job
  const jobBody: Record<string, string | null> = {
    status: 'Quote',
    job_address: lead.address,
    job_description: jobDescription,
  }
  if (companyUuid) jobBody.company_uuid = companyUuid

  const jobRes = await sm8Post('/job.json', apiKey, jobBody)

  if (!jobRes.ok) {
    const text = await jobRes.text().catch(() => '')
    return NextResponse.json({ error: `ServiceM8 job creation failed (${jobRes.status})`, detail: text }, { status: 502 })
  }

  const jobUuid = jobRes.headers.get('x-record-uuid')

  // Step 4: Add a contact (note) on the job with the lead's contact details
  if (jobUuid && (lead.phone || lead.email)) {
    const noteLines: string[] = [`Contact: ${lead.name}`]
    if (lead.phone) noteLines.push(`Phone: ${lead.phone}`)
    if (lead.email) noteLines.push(`Email: ${lead.email}`)
    if (lead.source) noteLines.push(`Source: ${lead.source}`)

    await sm8Post('/jobnote.json', apiKey, {
      job_uuid: jobUuid,
      type: 'note',
      note: noteLines.join('\n'),
    })
  }

  return NextResponse.json({ ok: true, companyUuid, jobUuid })
}
