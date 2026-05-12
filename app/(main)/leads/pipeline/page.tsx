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

  const leads = await prisma.lead.findMany({
    where: { ...accountFilter, ...companyFilter },
    include: { company: { select: { name: true, color: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return <PipelineBoard initialLeads={leads} />
}
