import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { getBaseUrl } from '@/lib/base-url'
import { NextRequest, NextResponse } from 'next/server'

// Show only enough of a stored key to confirm which one is set — never the
// full secret. e.g. "sk_live_...c0Ffee"
function mask(key: string | undefined): string {
  if (!key) return ''
  if (key.length <= 12) return `${key.slice(0, 4)}…`
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}

function assertAccess(user: { role?: string | null; accountId?: string | null; accountIds?: string[] | null }, accountId: string): boolean {
  if (user.role === 'master_admin') return true
  const ids = user.accountIds?.length ? user.accountIds : (user.accountId ? [user.accountId] : [])
  return ids.includes(accountId)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountParam = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, accountParam)
  // Resolve the target account: master admins pass ?account=, others use their own
  const accountId =
    session.user.role === 'master_admin'
      ? accountParam
      : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  const row = await prisma.accountIntegration.findFirst({
    where: { platform: 'stripe', ...filter, accountId },
  })

  let cfg: { secretKey?: string; publishableKey?: string; webhookSecret?: string } = {}
  if (row) { try { cfg = JSON.parse(row.config) } catch { cfg = {} } }

  return NextResponse.json({
    configured: Boolean(row?.enabled && cfg.secretKey),
    enabled: row?.enabled ?? false,
    secretKeyMasked: mask(cfg.secretKey),
    publishableKey: cfg.publishableKey ?? '',
    webhookSecretMasked: mask(cfg.webhookSecret),
    webhookUrl: `${getBaseUrl()}/api/webhooks/stripe/${accountId}`,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const accountId =
    session.user.role === 'master_admin'
      ? (body.accountId ?? null)
      : (session.user.accountId ?? null)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })
  if (!assertAccess(session.user, accountId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'stripe' } },
  })
  let prev: { secretKey?: string; publishableKey?: string; webhookSecret?: string } = {}
  if (existing) { try { prev = JSON.parse(existing.config) } catch { prev = {} } }

  // Preserve any secret the client didn't re-enter (it only ever sees masks).
  const secretKey = typeof body.secretKey === 'string' && body.secretKey.trim() ? body.secretKey.trim() : (prev.secretKey ?? '')
  const publishableKey = typeof body.publishableKey === 'string' ? body.publishableKey.trim() : (prev.publishableKey ?? '')
  const webhookSecret = typeof body.webhookSecret === 'string' && body.webhookSecret.trim() ? body.webhookSecret.trim() : (prev.webhookSecret ?? '')

  const enabled = body.enabled === false ? false : Boolean(secretKey)
  const config = JSON.stringify({ secretKey, publishableKey, webhookSecret })

  await prisma.accountIntegration.upsert({
    where: { accountId_platform: { accountId, platform: 'stripe' } },
    create: { accountId, platform: 'stripe', config, enabled },
    update: { config, enabled },
  })

  return NextResponse.json({ success: true, configured: enabled && Boolean(secretKey) })
}
