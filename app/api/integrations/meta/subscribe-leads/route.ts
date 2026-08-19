import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { subscribePages } from '@/lib/meta-leads'
import { NextRequest, NextResponse } from 'next/server'

// Re-subscribe an account's connected Facebook pages to the leadgen webhook.
// Useful after adding the leads_retrieval / pages_manage_metadata scopes, or to
// re-arm lead sync without a full reconnect. Requires the stored page tokens to
// already carry pages_manage_metadata (i.e. connected after the scope update).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId =
    session.user.role === 'master_admin'
      ? (req.nextUrl.searchParams.get('account') ?? session.user.accountId ?? null)
      : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account — master_admin must pass ?account=ID' }, { status: 400 })

  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'meta' } },
  })
  if (!integration?.enabled) return NextResponse.json({ error: 'Meta not connected for this account' }, { status: 404 })

  let pages: { id: string; accessToken?: string }[] = []
  try {
    const cfg = JSON.parse(integration.config) as { pages?: { id: string; accessToken?: string }[] }
    pages = cfg.pages ?? []
  } catch { /* leave empty */ }
  if (!pages.length) return NextResponse.json({ error: 'No Facebook pages found on this connection' }, { status: 400 })

  const results = await subscribePages(pages)
  return NextResponse.json({ accountId, pages: pages.length, results })
}
