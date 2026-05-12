import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import Link from 'next/link'
import { Suspense } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { Users, TrendingUp, CalendarDays } from 'lucide-react'
import DashboardCharts, { type WeeklyPoint, type StageValue } from './DashboardCharts'
import DashboardDateFilter from './DashboardDateFilter'

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#eab308',
  qualified: '#a855f7',
  won: '#22c55e',
  lost: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
}

function weekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string; updatedFrom?: string; updatedTo?: string; dateField?: string }>
}) {
  const session = await auth()
  const { account, from, to, updatedFrom, updatedTo, dateField } = await searchParams

  const accountFilter = getAccountFilter(session!.user, account)
  const companyFilter = {}

  const isUpdatedFilter = dateField === 'updated'
  const activeFrom = isUpdatedFilter ? updatedFrom : from
  const activeTo = isUpdatedFilter ? updatedTo : to
  const activeField = isUpdatedFilter ? 'updatedAt' : 'createdAt'

  const fromDate = activeFrom ? new Date(activeFrom) : undefined
  const toDate = activeTo ? new Date(`${activeTo}T23:59:59`) : undefined
  const dateFilter =
    fromDate || toDate
      ? { [activeField]: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}

  const where = { ...accountFilter, ...companyFilter, ...dateFilter }

  // For the weekly chart: use the period if set, otherwise last 12 weeks
  const chartFrom = fromDate ?? (() => { const d = new Date(); d.setDate(d.getDate() - 84); return d })()
  const chartTo = toDate ?? new Date()

  const now = new Date()
  const apptFilter = { ...accountFilter, startTime: { gte: now } }
  const quoteDateFilter = fromDate || toDate
    ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
    : {}

  const [total, byStatus, recentLeads, conversions, activeCompany, valueByStatus, chartLeads, upcomingAppts, pendingQuoteAgg, invoiceAgg] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ['status'], where, _count: true }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        company: { select: { name: true, color: true } },
        conversions: { where: { status: 'sent' }, select: { platform: true } },
      },
    }),
    prisma.conversionEvent.groupBy({
      by: ['platform'],
      where: { status: 'sent', lead: where },
      _count: true,
    }),
    Promise.resolve(null),
    prisma.lead.groupBy({
      by: ['status'],
      where,
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.lead.findMany({
      where: { ...accountFilter, ...companyFilter, createdAt: { gte: chartFrom, lte: chartTo } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.appointment.findMany({
      where: apptFilter,
      orderBy: { startTime: 'asc' },
      take: 6,
      include: { lead: { select: { id: true, name: true } } },
    }),
    prisma.quote.aggregate({
      where: { ...accountFilter, type: 'quote', status: { in: ['draft', 'sent'] }, ...quoteDateFilter },
      _sum: { total: true },
    }),
    prisma.quote.aggregate({
      where: { ...accountFilter, type: 'invoice', ...quoteDateFilter },
      _sum: { total: true },
    }),
  ])

  const sm = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const cm = Object.fromEntries(conversions.map((c) => [c.platform, c._count]))

  // Build week buckets between chartFrom and chartTo
  const buckets: Record<string, { leads: number; won: number }> = {}
  const cursor = new Date(chartFrom)
  const startDay = cursor.getDay()
  cursor.setDate(cursor.getDate() - (startDay === 0 ? 6 : startDay - 1))
  cursor.setHours(0, 0, 0, 0)
  while (cursor <= chartTo) {
    buckets[weekKey(new Date(cursor))] = { leads: 0, won: 0 }
    cursor.setDate(cursor.getDate() + 7)
  }
  for (const lead of chartLeads) {
    const key = weekKey(new Date(lead.createdAt))
    if (buckets[key]) {
      buckets[key].leads++
      if (lead.status === 'won') buckets[key].won++
    }
  }
  const weeklyData: WeeklyPoint[] = Object.entries(buckets).map(([week, d]) => ({ week, ...d }))

  // Stage value data
  const stageValues: StageValue[] = ['new', 'contacted', 'qualified', 'won', 'lost'].map((status) => {
    const found = valueByStatus.find((v) => v.status === status)
    return {
      stage: STATUS_LABELS[status],
      value: found?._sum.value ?? 0,
      count: found?._count._all ?? 0,
      color: STATUS_COLORS[status],
    }
  })
  const totalPipelineValue = stageValues.reduce((s, v) => s + v.value, 0)
  const wonValue = stageValues.find((s) => s.stage === 'Won')?.value ?? 0
  const activePipelineValue = stageValues
    .filter((s) => !['Won', 'Lost'].includes(s.stage))
    .reduce((s, v) => s + v.value, 0)
  const pendingQuoteValue = pendingQuoteAgg._sum.total ?? 0
  const totalInvoiceValue = invoiceAgg._sum.total ?? 0

  const fmtCurrency = (v: number) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
      ? `$${(v / 1_000).toFixed(1)}k`
      : `$${v.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
  const chartLabel =
    activeFrom && activeTo
      ? `${fmtDate(activeFrom)} – ${fmtDate(activeTo)}`
      : activeFrom
      ? `From ${fmtDate(activeFrom)}`
      : activeTo
      ? `Until ${fmtDate(activeTo)}`
      : '12 weeks'

  const statusStats = [
    { label: 'Total',     value: total,               color: 'text-slate-900' },
    { label: 'New',       value: sm.new ?? 0,         color: 'text-blue-600' },
    { label: 'Contacted', value: sm.contacted ?? 0,   color: 'text-yellow-600' },
    { label: 'Qualified', value: sm.qualified ?? 0,   color: 'text-purple-600' },
    { label: 'Won',       value: sm.won ?? 0,         color: 'text-green-600' },
    { label: 'Lost',      value: sm.lost ?? 0,        color: 'text-red-600' },
    { label: 'Booked',    value: upcomingAppts.length,    color: 'text-indigo-600' },
  ]

  const platformStats = [
    { label: 'GA4 Events',              value: cm.google_ga4 ?? 0 },
    { label: 'Google Ads Conversions',  value: cm.google_ads ?? 0 },
    { label: 'Facebook Events',         value: cm.facebook ?? 0 },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">Your lead pipeline at a glance</p>
        </div>
        <Link
          href="/leads/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 flex-shrink-0"
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Add Lead</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <Suspense fallback={null}>
          <DashboardDateFilter from={from} to={to} updatedFrom={updatedFrom} updatedTo={updatedTo} dateField={dateField} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pipeline Value</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{fmtCurrency(activePipelineValue)}</p>
          <p className="text-xs text-slate-400 mt-2">Active leads (excl. Won &amp; Lost)</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pending Quotes</p>
          <p className="text-3xl font-bold text-violet-600 mt-2">{fmtCurrency(pendingQuoteValue)}</p>
          <p className="text-xs text-slate-400 mt-2">Draft &amp; sent quotes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Invoice Value</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{fmtCurrency(totalInvoiceValue)}</p>
          <p className="text-xs text-slate-400 mt-2">All invoices in period</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {statusStats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <DashboardCharts
        byStatus={sm}
        weeklyData={weeklyData}
        stageValues={stageValues}
        totalPipelineValue={totalPipelineValue}
        wonValue={wonValue}
        chartLabel={chartLabel}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {platformStats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Leads */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Leads</h2>
            <Link href="/leads" className="text-indigo-600 text-sm hover:underline font-medium">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    { label: 'Name', cls: '' },
                    { label: 'Email', cls: 'hidden md:table-cell' },
                    { label: 'Service', cls: 'hidden lg:table-cell' },
                    { label: 'Status', cls: '' },
                    { label: 'Platforms', cls: 'hidden xl:table-cell' },
                    { label: 'Created', cls: 'hidden sm:table-cell' },
                  ].map(({ label, cls }) => (
                    <th key={label} className={`text-left text-xs font-medium text-slate-500 px-4 py-3 uppercase tracking-wide ${cls}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead) => {
                  const platforms = lead.conversions.map((c) => c.platform)
                  return (
                    <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition-colors text-sm">
                          {lead.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm hidden md:table-cell">{lead.email ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm hidden lg:table-cell">{lead.service ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <div className="flex gap-1">
                          {(['google_ga4', 'google_ads', 'facebook'] as const).map((p) => (
                            <span key={p} className={`text-xs px-1.5 py-0.5 rounded font-medium ${platforms.includes(p) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                              {p === 'google_ga4' ? 'GA4' : p === 'google_ads' ? 'ADS' : 'FB'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm hidden sm:table-cell">
                        {new Date(lead.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  )
                })}
                {recentLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">
                      No leads yet. <Link href="/leads/new" className="text-indigo-600 hover:underline">Add your first lead</Link>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Upcoming Appointments</h2>
            <Link href="/calendar" className="text-indigo-600 text-sm hover:underline font-medium">
              Calendar →
            </Link>
          </div>
          {upcomingAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CalendarDays className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No upcoming appointments</p>
              <Link href="/calendar" className="mt-2 text-xs text-indigo-600 hover:underline">
                Schedule one →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {upcomingAppts.map((appt) => {
                const start = new Date(appt.startTime)
                const isToday = start.toDateString() === now.toDateString()
                const isTomorrow = start.toDateString() === new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString()
                const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow'
                  : start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

                return (
                  <div key={appt.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isToday ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{appt.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span className={isToday ? 'font-semibold text-indigo-600' : ''}>{dayLabel}</span>
                          {!appt.allDay && (
                            <span className="ml-1">
                              · {start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          )}
                        </p>
                        {appt.lead && (
                          <Link
                            href={`/leads/${appt.lead.id}`}
                            className="text-xs text-indigo-600 hover:underline mt-0.5 block truncate"
                          >
                            {appt.lead.name}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
