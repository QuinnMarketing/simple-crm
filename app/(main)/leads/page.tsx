import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import Link from 'next/link'
import LeadsSearch from './LeadsSearch'
import LeadsCsvButtons from './LeadsCsvButtons'
import LeadsTable from './LeadsTable'
import { Kanban } from 'lucide-react'

const STATUSES = ['all', 'new', 'contacted', 'qualified', 'won', 'lost', 'junk']
const PAGE_SIZE = 100

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; company?: string; account?: string; idle?: string; page?: string }>
}) {
  const session = await auth()
  const { status, q, company, account, idle, page } = await searchParams

  const accountFilter = getAccountFilter(session!.user, account)
  const companyFilter = company ? { companyId: company } : {}
  const isAllAccounts = session!.user.role === 'master_admin' && !account
  const isIdle = idle === '1'
  const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1)

  const accountId = session!.user.role === 'master_admin' ? (account ?? null) : (session!.user.accountId ?? null)

  const where = {
    ...accountFilter,
    ...companyFilter,
    ...(isIdle
      ? { status: { in: ['new', 'contacted', 'qualified'] }, updatedAt: { lte: new Date(Date.now() - 7 * 86_400_000) } }
      : {
          ...(status && status !== 'all' ? { status } : {}),
          ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { service: { contains: q } }] } : {}),
        }),
  }

  const [leads, totalCount, activeCompany, accountSettings] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        company: { select: { name: true, color: true } },
        conversions: { where: { status: 'sent' }, select: { platform: true } },
        ...(isAllAccounts ? { account: { select: { name: true } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
    company ? prisma.company.findUnique({ where: { id: company }, select: { name: true, color: true } }) : null,
    accountId ? prisma.account.findUnique({ where: { id: accountId }, select: { slaHours: true } }) : null,
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (q) params.set('q', q)
    if (company) params.set('company', company)
    if (account) params.set('account', account)
    if (isIdle) params.set('idle', '1')
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/leads${qs ? `?${qs}` : ''}`
  }

  function statusHref(s: string) {
    const p = new URLSearchParams()
    if (s !== 'all') p.set('status', s)
    if (q) p.set('q', q)
    if (company) p.set('company', company)
    if (account) p.set('account', account)
    return `/leads?${p.toString()}`
  }

  const newLeadHref = `/leads/new${company ? `?company=${company}` : ''}`

  const exportParams = new URLSearchParams()
  if (status && status !== 'all') exportParams.set('status', status)
  if (q) exportParams.set('q', q)
  if (company) exportParams.set('company', company)
  if (account) exportParams.set('account', account)
  const exportHref = `/api/leads/export${exportParams.toString() ? `?${exportParams}` : ''}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
            {activeCompany && (
              <span className="text-sm font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: activeCompany.color + '20', color: activeCompany.color }}>
                {activeCompany.name}
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            {isIdle && <span className="inline-flex items-center gap-1 text-amber-600 font-medium mr-1">⏳ Idle deals ·</span>}
            {totalCount} lead{totalCount !== 1 ? 's' : ''}
            {totalPages > 1 && <span className="text-slate-400"> · page {pageNum} of {totalPages}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Link
            href={`/leads/pipeline${company ? `?company=${company}` : ''}${account ? `${company ? '&' : '?'}account=${account}` : ''}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Kanban className="w-4 h-4" />
            <span className="hidden sm:inline">Pipeline</span>
          </Link>
          <LeadsCsvButtons exportHref={exportHref} accountId={account ?? session!.user.accountId} />
          <Link href={newLeadHref} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            + <span className="hidden sm:inline">Add Lead</span><span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <LeadsSearch defaultQ={q} />
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={statusHref(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  (s === 'all' && !status) || status === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

        <LeadsTable
          leads={leads as unknown as Parameters<typeof LeadsTable>[0]['leads']}
          addHref={newLeadHref}
          clearHref={(q || status || isIdle) ? `/leads${company ? `?company=${company}` : ''}${account ? `${company ? '&' : '?'}account=${account}` : ''}` : undefined}
          slaHours={accountSettings?.slaHours}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {(pageNum - 1) * PAGE_SIZE + 1}–{Math.min(pageNum * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              {pageNum > 1 ? (
                <Link href={pageHref(pageNum - 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  ← Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-100 text-slate-300">← Previous</span>
              )}
              {pageNum < totalPages ? (
                <Link href={pageHref(pageNum + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  Next →
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-100 text-slate-300">Next →</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
