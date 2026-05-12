import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { parseCsv } from '@/lib/csv'
import { NextRequest, NextResponse } from 'next/server'

const VALID_STATUSES = new Set(['new', 'contacted', 'qualified', 'won', 'lost'])
const VALID_SOURCES = new Set(['website', 'referral', 'google_ads', 'facebook_ads', 'cold_outreach', 'webhook', 'other'])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  let csvText: string
  let requestedAccountId: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    csvText = await (file as File).text()
    const acct = form.get('accountId')
    if (acct && typeof acct === 'string') requestedAccountId = acct
  } else {
    csvText = await req.text()
  }

  // Resolve which account to import into:
  // - master_admin: use the accountId from the request (must be a real account)
  // - regular user: always use their own accountId, ignore any request param
  let accountId: string | null
  if (session.user.role === 'master_admin') {
    if (requestedAccountId) {
      const exists = await prisma.account.findUnique({ where: { id: requestedAccountId }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      accountId = requestedAccountId
    } else {
      accountId = null
    }
  } else {
    accountId = session.user.accountId ?? null
  }

  if (!csvText.trim()) return NextResponse.json({ error: 'Empty file' }, { status: 400 })

  const rows = parseCsv(csvText)
  if (rows.length === 0) return NextResponse.json({ error: 'No data rows found — check the file has a header row' }, { status: 400 })

  // Pre-load companies for name lookup
  const companies = accountId
    ? await prisma.company.findMany({ where: { accountId }, select: { id: true, name: true } })
    : []
  const companyByName = new Map(companies.map((c) => [c.name.toLowerCase(), c.id]))

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +1 for header, +1 for 1-based

    const name = row.name?.trim()
    if (!name) { skipped++; continue }

    const value = row.value?.trim() ? parseFloat(row.value) : null
    const status = VALID_STATUSES.has(row.status?.trim()) ? row.status.trim() : 'new'
    const source = VALID_SOURCES.has(row.source?.trim()) ? row.source.trim() : (row.source?.trim() || null)

    const companyName = row.company?.trim()
    const companyId = companyName ? (companyByName.get(companyName.toLowerCase()) ?? null) : null

    try {
      await prisma.lead.create({
        data: {
          name,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          address: row.address?.trim() || null,
          service: row.service?.trim() || null,
          notes: row.notes?.trim() || null,
          pageUrl: row.pageurl?.trim() || row.pageUrl?.trim() || null,
          gclid: row.gclid?.trim() || null,
          status,
          source,
          value: isNaN(value as number) ? null : value,
          companyId,
          accountId,
        },
      })
      created++
    } catch (err) {
      errors.push(`Row ${rowNum} (${name}): ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({ created, skipped, errors })
}
