import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

interface AroFloCreds {
  uEncoded: string
  pEncoded: string
  orgEncoded: string
  secretKey: string
  taskType?: string
}

const AROFLO_BASE = 'https://api.aroflo.com/'

function buildHeaders(creds: AroFloCreds, method: string, rawPostFields: string) {
  const authorization =
    `uencoded=${encodeURIComponent(creds.uEncoded)}` +
    `&pencoded=${encodeURIComponent(creds.pEncoded)}` +
    `&orgEncoded=${encodeURIComponent(creds.orgEncoded)}`

  // AroFlo requires microsecond-precision UTC timestamp
  const timestamp = new Date().toISOString().replace(/\.(\d{3})Z$/, '.$1000Z')

  const signingStr = `${method}++text/json+${authorization}+${timestamp}+${rawPostFields}`
  const hmac = createHmac('sha512', creds.secretKey).update(signingStr).digest('hex')

  return {
    Authorization: authorization,
    Authentication: `HMAC ${hmac}`,
    Accept: 'text/json',
    afdatetimeutc: timestamp,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

function cdata(value: string | null | undefined): string {
  return value ? `<![CDATA[${value}]]>` : ''
}

async function aroFloPost(creds: AroFloCreds, zone: string, xml: string) {
  const rawPostFields = `zone=${zone}&postxml=${xml}`
  const headers = buildHeaders(creds, 'POST', rawPostFields)
  const body = new URLSearchParams({ zone, postxml: xml }).toString()

  return fetch(AROFLO_BASE, { method: 'POST', headers, body })
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const { id } = await params

  const integration = await prisma.accountIntegration.findFirst({
    where: { accountId, platform: 'aroflo', enabled: true },
  })
  if (!integration) return NextResponse.json({ error: 'AroFlo not configured' }, { status: 404 })

  let creds: AroFloCreds
  try {
    creds = JSON.parse(integration.config) as AroFloCreds
    if (!creds.uEncoded || !creds.pEncoded || !creds.orgEncoded || !creds.secretKey) throw new Error()
  } catch {
    return NextResponse.json({ error: 'AroFlo credentials incomplete' }, { status: 422 })
  }

  const lead = await prisma.lead.findFirst({ where: { id, accountId } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const nameParts = lead.name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

  // Step 1: Create client
  const clientXml = `<clients><client>` +
    `<clientname>${cdata(lead.name)}</clientname>` +
    `<firstname>${cdata(firstName)}</firstname>` +
    `<surname>${cdata(lastName)}</surname>` +
    `<phone>${cdata(lead.phone)}</phone>` +
    `<email>${cdata(lead.email)}</email>` +
    `<orgs><org><orgid>${cdata(creds.orgEncoded)}</orgid></org></orgs>` +
    `</client></clients>`

  const clientRes = await aroFloPost(creds, 'clients', clientXml)
  if (!clientRes.ok) {
    const text = await clientRes.text().catch(() => '')
    return NextResponse.json({ error: `AroFlo client creation failed (${clientRes.status})`, detail: text }, { status: 502 })
  }

  // Extract client ID from response
  let clientId: string | null = null
  try {
    const data = await clientRes.json() as Record<string, unknown>
    // Response shape varies — try common paths
    const clientsNode = data.clients as Record<string, unknown> | undefined
    const clientNode = clientsNode?.client as Record<string, unknown> | Record<string, unknown>[] | undefined
    const first = Array.isArray(clientNode) ? clientNode[0] : clientNode
    clientId = (first as Record<string, string> | undefined)?.id ?? (data.id as string | undefined) ?? null
  } catch { /* response parsing failed — proceed without clientId */ }

  // Step 2: Build job description
  const descParts: string[] = []
  if (lead.service) descParts.push(lead.service)
  if (lead.notes) descParts.push(lead.notes)
  if (lead.source) descParts.push(`Source: ${lead.source}`)
  const description = descParts.join('\n\n') || 'New lead from CRM'

  const taskName = lead.service?.slice(0, 200) ?? lead.name

  // Due date: 7 days from now
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const dueDate = due.toISOString().split('T')[0]

  const taskXml = `<tasks><task>` +
    `<taskname>${cdata(taskName)}</taskname>` +
    `<description>${cdata(description)}</description>` +
    (clientId ? `<clientid>${clientId}</clientid>` : '') +
    `<duedate>${dueDate}</duedate>` +
    (creds.taskType ? `<tasktype>${cdata(creds.taskType)}</tasktype>` : '') +
    `<orgs><org><orgid>${cdata(creds.orgEncoded)}</orgid></org></orgs>` +
    `</task></tasks>`

  const taskRes = await aroFloPost(creds, 'tasks', taskXml)
  if (!taskRes.ok) {
    const text = await taskRes.text().catch(() => '')
    return NextResponse.json({ error: `AroFlo task creation failed (${taskRes.status})`, detail: text }, { status: 502 })
  }

  let taskId: string | null = null
  try {
    const data = await taskRes.json() as Record<string, unknown>
    const tasksNode = data.tasks as Record<string, unknown> | undefined
    const taskNode = tasksNode?.task as Record<string, unknown> | Record<string, unknown>[] | undefined
    const first = Array.isArray(taskNode) ? taskNode[0] : taskNode
    taskId = (first as Record<string, string> | undefined)?.id ?? (data.id as string | undefined) ?? null
  } catch { /* ok */ }

  return NextResponse.json({ ok: true, clientId, taskId })
}
