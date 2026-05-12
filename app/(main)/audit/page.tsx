import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getAccountFilter } from '@/lib/account-scope'
import { History } from 'lucide-react'

const PAGE_SIZE = 50

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-emerald-100 text-emerald-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
}

const ENTITY_LABELS: Record<string, string> = {
  lead: 'Lead',
  quote: 'Quote/Invoice',
  appointment: 'Appointment',
  company: 'Company',
  user: 'User',
  automation: 'Automation',
  time_entry: 'Time Entry',
}

function actionColor(action: string) {
  if (action.endsWith('.created')) return ACTION_COLORS.created
  if (action.endsWith('.deleted')) return ACTION_COLORS.deleted
  return ACTION_COLORS.updated
}

function actionLabel(action: string) {
  return action.replace('_', ' ').replace('.', ' → ')
}

function fmtDate(d: Date) {
  return d.toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entityType?: string; account?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page = '1', entityType, account: accountParam } = await searchParams

  const pageNum = Math.max(1, parseInt(page) || 1)
  const skip = (pageNum - 1) * PAGE_SIZE

  const accountFilter = getAccountFilter(session.user, accountParam)
  const accountId = (accountFilter as { accountId?: string }).accountId ?? null

  const where = {
    ...(accountId ? { accountId } : {}),
    ...(entityType ? { entityType } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    params.set('page', String(p))
    if (entityType) params.set('entityType', entityType)
    if (accountParam) params.set('account', accountParam)
    return `/audit?${params}`
  }

  function filterUrl(et: string | null) {
    const params = new URLSearchParams()
    if (et) params.set('entityType', et)
    if (accountParam) params.set('account', accountParam)
    return `/audit?${params}`
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
          <History className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total.toLocaleString()} event{total !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <a href={filterUrl(null)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!entityType ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          All
        </a>
        {Object.entries(ENTITY_LABELS).map(([key, label]) => (
          <a key={key} href={filterUrl(key)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${entityType === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {label}
          </a>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center py-20 text-slate-400">
          <History className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No audit events yet</p>
          <p className="text-sm mt-1">Actions across the CRM will appear here</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">When</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Who</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    let changes: Record<string, [unknown, unknown]> | null = null
                    try { changes = log.changes ? JSON.parse(log.changes) : null } catch { /* ignore */ }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                          {fmtDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(log.action)}`}>
                            {actionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-500 text-xs">{ENTITY_LABELS[log.entityType] ?? log.entityType}</p>
                          <p className="font-medium text-slate-800 text-xs mt-0.5 truncate max-w-48">{log.entityLabel ?? log.entityId}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                          {log.userEmail ?? <span className="text-slate-300">webhook</span>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {changes && Object.keys(changes).length > 0 ? (
                            <div className="space-y-0.5">
                              {Object.entries(changes).slice(0, 3).map(([field, [from, to]]) => (
                                <div key={field} className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-slate-600">{field}</span>
                                  <span className="text-slate-300 line-through truncate max-w-24">{String(from ?? '—')}</span>
                                  <span className="text-slate-300">→</span>
                                  <span className="text-slate-700 truncate max-w-24">{String(to ?? '—')}</span>
                                </div>
                              ))}
                              {Object.keys(changes).length > 3 && (
                                <p className="text-xs text-slate-400">+{Object.keys(changes).length - 3} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-slate-500 text-xs">
                Page {pageNum} of {totalPages} ({total.toLocaleString()} events)
              </p>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <a href={pageUrl(pageNum - 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-medium">
                    Previous
                  </a>
                )}
                {pageNum < totalPages && (
                  <a href={pageUrl(pageNum + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-medium">
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
