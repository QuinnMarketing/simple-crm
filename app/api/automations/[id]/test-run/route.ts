import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { testRunAutomation } from '@/lib/automation-engine'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const qAccountId = req.nextUrl.searchParams.get('account')
  const filter = getAccountFilter(session.user, qAccountId)

  const automation = await prisma.automation.findFirst({ where: { id, ...filter } })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (automation.steps === '{}') {
    return NextResponse.json({ error: 'This automation uses the legacy format — open in builder and save first' }, { status: 400 })
  }

  const body = await req.json()
  const { leadId } = body
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...filter } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  try {
    const runId = await testRunAutomation(
      { id: automation.id, steps: automation.steps, accountId: automation.accountId },
      leadId,
    )
    const run = await prisma.automationRun.findUnique({
      where: { id: runId },
      include: { stepLogs: { orderBy: { executedAt: 'asc' } } },
    })
    return NextResponse.json(run)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Execution failed' }, { status: 500 })
  }
}
