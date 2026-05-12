import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import LeadsSearch from './LeadsSearch'
import { Kanban } from 'lucide-react'

const STATUSES = ['all', 'new', 'contacted', 'qualified', 'won', 'lost']

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; company?: string; account?: string }>
}) {
  const session = await auth()
  const { status, q, company, account } = await searchParams

  const accountFilter = getAccountFilter(session!.user, account)
  const companyFilter = company ? { companyId: company } : {}
  const isAllAccounts = session!.user.role === 'master_admin' && !account

  const [leads, activeCompany] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...accountFilter,
        ...companyFilter,
        ...(status && status !== 'all' ? { status } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { service: { contains: q } }] } : {}),
      },
      include: {
        company: { select: { name: true, color: true } },
        conversions: { where: { status: 'sent' }, select: { platform: true } },
        ...(isAllAccounts ? { account: { select: { name: true } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    }),
    company ? prisma.company.findUnique({ where: { id: company }, select: { name: true, color: true } }) : null,
  ])

  function statusHref(s: string) {
    const p = new URLSearchParams()
    if (s !== 'all') p.set('status', s)
    if (q) p.set('q', q)
    if (company) p.set('company', company)
    if (account) p.set('account', account)
    return `/leads?${p.toString()}`
  }

  const newLeadHref = `/leads/new${company ? `?company=${company}` : ''}`

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
          <p className="text-slate-500 mt-1 text-sm">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/leads/pipeline${company ? `?company=${company}` : ''}${account ? `${company ? '&' : '?'}account=${account}` : ''}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Kanban className="w-4 h-4" />
            <span className="hidden sm:inline">Pipeline</span>
          </Link>
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

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  { label: 'Name', cls: '' },
                  { label: 'Email / Phone', cls: 'hidden md:table-cell' },
                  { label: 'Service', cls: 'hidden lg:table-cell' },
                  { label: 'Company', cls: 'hidden lg:table-cell' },
                  { label: 'Value', cls: 'hidden sm:table-cell' },
                  { label: 'Status', cls: '' },
                  { label: 'Platforms', cls: 'hidden xl:table-cell' },
                  { label: 'Added', cls: 'hidden sm:table-cell' },
                ].map(({ label, cls }) => (
                  <th key={label} className={`text-left text-xs font-medium text-slate-500 px-4 py-3 uppercase tracking-wide whitespace-nowrap ${cls}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const platforms = lead.conversions.map((c) => c.platform)
                return (
                  <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                        {lead.name}
                      </Link>
                      {'account' in lead && lead.account && (
                        <p className="text-xs text-indigo-600 font-medium mt-0.5">{(lead.account as { name: string }).name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-sm text-slate-700">{lead.email ?? '—'}</div>
                      <div className="text-xs text-slate-400">{lead.phone ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">{lead.service ?? '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {lead.company ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: lead.company.color + '20', color: lead.company.color }}>
                          {lead.company.name}
                        </span>
                      ) : <span className="text-slate-400 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                      {lead.value ? `$${lead.value.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex gap-1">
                        {(['google_ga4', 'google_ads', 'facebook'] as const).map((p) => (
                          <span key={p} title={p} className={`text-xs px-1.5 py-0.5 rounded font-medium ${platforms.includes(p) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                            {p === 'google_ga4' ? 'GA4' : p === 'google_ads' ? 'ADS' : 'FB'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                      <p className="text-xs text-slate-500">{new Date(lead.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                      {lead.updatedAt > lead.createdAt && (
                        <p className="text-xs text-slate-400 mt-0.5">edited {new Date(lead.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No leads found.{' '}
                    {q || status ? (
                      <Link href={`/leads${company ? `?company=${company}` : ''}`} className="text-indigo-600 hover:underline">Clear filters</Link>
                    ) : (
                      <Link href={newLeadHref} className="text-indigo-600 hover:underline">Add one manually</Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
