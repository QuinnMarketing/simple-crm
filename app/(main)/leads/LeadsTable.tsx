'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, ChevronDown, Loader2, X } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'

type Lead = {
  id: string; name: string; email: string | null; phone: string | null
  service: string | null; status: string; value: number | null
  firstRespondedAt: string | null
  createdAt: string; updatedAt: string
  company: { name: string; color: string } | null
  conversions: { platform: string }[]
  account?: { name: string } | null
}

export default function LeadsTable({ leads, addHref, clearHref, slaHours }: {
  leads: Lead[]; addHref?: string; clearHref?: string; slaHours?: number | null
}) {

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'junk']

  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} lead${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setBusy(true)
    await Promise.all([...selected].map((id) => fetch(`/api/leads/${id}`, { method: 'DELETE' })))
    setSelected(new Set())
    setBusy(false)
    startTransition(() => router.refresh())
  }

  async function bulkStatus(status: string) {
    setBusy(true)
    setStatusOpen(false)
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      )
    )
    setSelected(new Set())
    setBusy(false)
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={toggleAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
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
              const isSelected = selected.has(lead.id)
              return (
                <tr
                  key={lead.id}
                  className={`border-b border-slate-50 transition-colors last:border-0 ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(lead.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                      {lead.name}
                    </Link>
                    {lead.account && (
                      <p className="text-xs text-indigo-600 font-medium mt-0.5">{lead.account.name}</p>
                    )}
                    {(() => {
                      if (lead.status !== 'new') return null
                      const waitMs = Date.now() - new Date(lead.createdAt).getTime()
                      const totalMin = Math.floor(waitMs / 60_000)
                      const h = Math.floor(totalMin / 60)
                      const m = totalMin % 60
                      const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${totalMin}m`
                      const slaMs = slaHours ? slaHours * 3_600_000 : null
                      const overdue = slaMs != null && waitMs > slaMs
                      if (lead.firstRespondedAt) return null
                      return (
                        <p className={`text-xs mt-0.5 font-medium ${overdue ? 'text-red-600' : 'text-slate-400'}`}>
                          Waiting {label}{overdue ? ' · SLA overdue' : ''}
                        </p>
                      )
                    })()}
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
                <td colSpan={9} className="px-5 py-12 text-center text-slate-400 text-sm">
                  No leads found.{' '}
                  {clearHref
                    ? <Link href={clearHref} className="text-indigo-600 hover:underline">Clear filters</Link>
                    : addHref
                    ? <Link href={addHref} className="text-indigo-600 hover:underline">Add one manually</Link>
                    : null}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 text-sm">
          {(busy || isPending) && <Loader2 className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0" />}

          <span className="font-medium text-slate-200 whitespace-nowrap">
            {selected.size} selected
          </span>

          <div className="w-px h-5 bg-slate-700" />

          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Change Status <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {statusOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-10 min-w-[140px]">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => bulkStatus(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 capitalize transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={bulkDelete}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          <button
            onClick={() => setSelected(new Set())}
            className="text-slate-400 hover:text-white transition-colors ml-1"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  )
}
