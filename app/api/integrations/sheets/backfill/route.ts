import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { backfillLeadsToSheet, ensureHeadersInSheet } from '@/lib/google-sheets'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Check for admin token in query param or header (allows running backfill without session)
  const token = req.nextUrl.searchParams.get('token') || req.headers.get('x-admin-token')
  const expectedToken = process.env.ADMIN_TOKEN

  let isAuthorized = false

  // Check token-based auth first
  if (token && expectedToken && token === expectedToken) {
    isAuthorized = true
  } else {
    // Fall back to session auth
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only allow master admins to backfill
    if (session.user.role !== 'master_admin') {
      return NextResponse.json({ error: 'Only master admins can backfill leads' }, { status: 403 })
    }
    isAuthorized = true
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Ensure headers are in the sheet first
    await ensureHeadersInSheet()

    // Fetch all leads with their account info
    const leads = await prisma.lead.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        service: true,
        source: true,
        value: true,
        status: true,
        bestTimeToContact: true,
        notes: true,
        accountId: true,
        account: {
          select: { name: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // Map to include account name
    const leadsWithAccounts = leads.map((lead) => ({
      ...lead,
      accountName: lead.account?.name || 'Unassigned',
    }))

    if (leadsWithAccounts.length === 0) {
      return NextResponse.json({ message: 'No leads to backfill', success: 0, failed: 0 })
    }

    // Backfill all leads to sheet
    const result = await backfillLeadsToSheet(leadsWithAccounts)

    return NextResponse.json({
      message: `Backfilled ${result.success} leads to Google Sheet`,
      success: result.success,
      failed: result.failed,
      total: leadsWithAccounts.length,
    })
  } catch (err) {
    console.error('Backfill error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backfill failed' },
      { status: 500 }
    )
  }
}
