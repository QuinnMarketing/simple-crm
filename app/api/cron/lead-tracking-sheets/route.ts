import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { syncLeadsToTrackingSheet } from '@/lib/lead-tracking-sheet'
import { NextRequest, NextResponse } from 'next/server'

// Runs on Vercel's own cron schedule (vercel.json) to reconcile every
// account's lead-tracking sheet: appends leads missing from the sheet and
// refreshes Suburb/Lead Source/Lead Quality/Comments on ones already there
// (so a lead's quality rating stays current as its status changes, even if
// the real-time hook in leads/[id]/route.ts missed it for any reason).
// Can also be called manually with LEAD_SHEET_SYNC_SECRET as ?secret=...
function isAuthorized(req: NextRequest): boolean {
  if (isAuthorizedCron(req)) return true
  const secret = process.env.LEAD_SHEET_SYNC_SECRET
  if (!secret) return false
  return req.nextUrl.searchParams.get('secret') === secret
}

// One-off bootstrap: registers the lead_tracking_sheet integration for an
// account by name, since there's no settings UI for this yet. Idempotent —
// safe to call again to update the spreadsheetId/sheetName.
async function setupIntegration(accountName: string, spreadsheetId: string, sheetName: string) {
  const account = await prisma.account.findFirst({
    where: { name: { contains: accountName, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!account) return { error: `No account matching "${accountName}"` }

  const integration = await prisma.accountIntegration.upsert({
    where: { accountId_platform: { accountId: account.id, platform: 'lead_tracking_sheet' } },
    create: {
      accountId: account.id,
      platform: 'lead_tracking_sheet',
      config: JSON.stringify({ spreadsheetId, sheetName }),
    },
    update: {
      config: JSON.stringify({ spreadsheetId, sheetName }),
      enabled: true,
    },
  })
  return { accountId: account.id, accountName: account.name, integrationId: integration.id }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const setupAccount = req.nextUrl.searchParams.get('setupAccount')
  const setupSheetId = req.nextUrl.searchParams.get('setupSheetId')
  const setupSheetName = req.nextUrl.searchParams.get('setupSheetName')
  if (setupAccount && setupSheetId && setupSheetName) {
    const result = await setupIntegration(setupAccount, setupSheetId, setupSheetName)
    return NextResponse.json({ ok: true, setup: result })
  }

  const integrations = await prisma.accountIntegration.findMany({
    where: { platform: 'lead_tracking_sheet', enabled: true },
  })

  const results = []
  for (const integration of integrations) {
    let config: { spreadsheetId?: string; sheetName?: string }
    try {
      config = JSON.parse(integration.config)
    } catch {
      results.push({ accountId: integration.accountId, error: 'invalid config JSON' })
      continue
    }
    if (!config.spreadsheetId || !config.sheetName) {
      results.push({ accountId: integration.accountId, error: 'missing spreadsheetId/sheetName' })
      continue
    }

    try {
      const leads = await prisma.lead.findMany({
        where: { accountId: integration.accountId },
        select: { id: true, email: true, address: true, source: true, status: true, notes: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      const result = await syncLeadsToTrackingSheet(config.spreadsheetId, config.sheetName, leads)
      results.push({ accountId: integration.accountId, total: leads.length, ...result })
    } catch (err) {
      results.push({ accountId: integration.accountId, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ ok: true, results })
}
