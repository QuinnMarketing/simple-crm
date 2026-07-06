import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import PipelineBoard from './PipelineBoard'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; company?: string }>
}) {
  const session = await auth()
  const { account, company } = await searchParams

  const accountFilter = getAccountFilter(session!.user, account)
  const companyFilter = company ? { companyId: company } : {}

  // Cap the board at the most recent 500 — beyond that a kanban is unusable
  // anyway, and unbounded relation includes blow Postgres bind-variable limits
  const leads = await prisma.lead.findMany({
    where: { ...accountFilter, ...companyFilter },
    include: { company: { select: { name: true, color: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  return <PipelineBoard initialLeads={leads} />
}
