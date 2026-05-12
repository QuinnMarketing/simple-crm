'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

const PRESETS: { label: string; getRange: () => { from: string; to: string } }[] = [
  { label: 'Today',     getRange: () => { const d = isoDate(new Date()); return { from: d, to: d } } },
  { label: 'Yesterday', getRange: () => { const d = daysAgo(1); return { from: d, to: d } } },
  { label: '3d',        getRange: () => ({ from: daysAgo(3),   to: isoDate(new Date()) }) },
  { label: '7d',        getRange: () => ({ from: daysAgo(7),   to: isoDate(new Date()) }) },
  { label: '30d',       getRange: () => ({ from: daysAgo(30),  to: isoDate(new Date()) }) },
  { label: '90d',       getRange: () => ({ from: daysAgo(90),  to: isoDate(new Date()) }) },
  { label: '12m',       getRange: () => ({ from: daysAgo(365), to: isoDate(new Date()) }) },
]

interface Props {
  from?: string
  to?: string
  updatedFrom?: string
  updatedTo?: string
  dateField?: string
}

export default function DashboardDateFilter({ from, to, updatedFrom, updatedTo, dateField = 'created' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const isUpdated = dateField === 'updated'
  const activeFrom = isUpdated ? updatedFrom : from
  const activeTo = isUpdated ? updatedTo : to
  const today = isoDate(new Date())

  function applyRange(range: { from: string; to: string }) {
    if (isUpdated) {
      updateParams({ updatedFrom: range.from, updatedTo: range.to })
    } else {
      updateParams({ from: range.from, to: range.to })
    }
  }

  function clearActive() {
    if (isUpdated) {
      updateParams({ updatedFrom: null, updatedTo: null })
    } else {
      updateParams({ from: null, to: null })
    }
  }

  function switchField(field: string) {
    updateParams({ dateField: field })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Field toggle */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
        <button
          onClick={() => switchField('created')}
          className={`px-3 py-1.5 transition-colors ${!isUpdated ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Created
        </button>
        <button
          onClick={() => switchField('updated')}
          className={`px-3 py-1.5 border-l border-slate-200 transition-colors ${isUpdated ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Last Updated
        </button>
      </div>

      {/* Presets */}
      {PRESETS.map((p) => {
        const range = p.getRange()
        const active = activeFrom === range.from && activeTo === range.to
        return (
          <button
            key={p.label}
            onClick={() => applyRange(range)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              active
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        )
      })}

      {/* Custom date inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={activeFrom ?? ''}
          max={activeTo ?? today}
          onChange={(e) => updateParams(isUpdated ? { updatedFrom: e.target.value || null } : { from: e.target.value || null })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-400">to</span>
        <input
          type="date"
          value={activeTo ?? ''}
          min={activeFrom}
          max={today}
          onChange={(e) => updateParams(isUpdated ? { updatedTo: e.target.value || null } : { to: e.target.value || null })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {(activeFrom || activeTo) && (
        <button onClick={clearActive} className="text-xs text-indigo-600 hover:underline">
          Clear
        </button>
      )}
    </div>
  )
}
