import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { MODULES, type ModuleKey } from '@/lib/modules'
import { getEnabledModulesForAccount } from '@/lib/account-modules'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

const VALID_KEYS = new Set(MODULES.map(m => m.key))

// Returns every module with its current enabled state for this account
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const enabled = await getEnabledModulesForAccount(id)
  return NextResponse.json({
    modules: MODULES.map(m => ({ key: m.key, label: m.label, description: m.description, enabled: enabled.has(m.key) })),
  })
}

// Toggle a single module override for the account
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const moduleKey = body.moduleKey as string
  const enabled = Boolean(body.enabled)

  if (!VALID_KEYS.has(moduleKey as ModuleKey)) {
    return NextResponse.json({ error: 'Unknown module' }, { status: 400 })
  }

  const account = await prisma.account.findUnique({ where: { id }, select: { id: true } })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  await prisma.accountModule.upsert({
    where: { accountId_moduleKey: { accountId: id, moduleKey } },
    create: { accountId: id, moduleKey, enabled },
    update: { enabled },
  })

  // Keep the legacy featTakeoffs flag in sync so nothing reads a stale value
  if (moduleKey === 'takeoffs') {
    await prisma.account.update({ where: { id }, data: { featTakeoffs: enabled } })
  }

  const current = await getEnabledModulesForAccount(id)
  return NextResponse.json({ ok: true, enabled: [...current] })
}
