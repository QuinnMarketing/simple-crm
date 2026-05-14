'use client'
import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import type { StageEntry } from '@/app/api/leads/[id]/stage-time/route'

const STATUS_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  new:       { bg: 'bg-blue-100',   text: 'text-blue-700',   bar: 'bg-blue-400' },
  contacted: { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-400' },
  qualified: { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-400' },
  won:       { bg: 'bg-green-100',  text: 'text-green-700',  bar: 'bg-green-400' },
  lost:      { bg: 'bg-red-100',    text: 'text-red-700',    bar: 'bg-red-400' },
}

function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60_000)
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(ms / 86_400_000)
  const w = Math.floor(d / 7)

  if (w >= 2) return `${w}w${d % 7 ? ` ${d % 7}d` : ''}`
  if (d >= 1) return `${d}d${h % 24 ? ` ${h % 24}h` : ''}`
  if (h >= 1) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`
  return m < 1 ? '<1m' : `${m}m`
}

export default function TimeInStageCard({ leadId }: { leadId: string }) {
  const [entries, setEntries] = useState<StageEntry[] | null>(null)

  useEffect(() => {
    fetch(`/api/leads/${leadId}/stage-time`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setEntries(d) })
      .catch(() => {})
  }, [leadId])

  if (!entries || entries.length === 0) return null

  const totalMs = entries.reduce((s, e) => s + e.durationMs, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
          <Timer className="w-4 h-4 text-slate-500" />
        </div>
        <h2 className="font-semibold text-slate-900">Time in Stage</h2>
      </div>

      <div className="space-y-3">
        {entries.map((entry, i) => {
          const colors = STATUS_COLORS[entry.status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400' }
          const pct = totalMs > 0 ? Math.max(2, Math.round((entry.durationMs / totalMs) * 100)) : 100
          const isCurrent = entry.exitedAt === null

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${colors.bg} ${colors.text}`}>
                    {entry.status}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-slate-400 font-medium">current</span>
                  )}
                </div>
                <span className={`text-xs font-semibold tabular-nums ${isCurrent ? 'text-slate-700' : 'text-slate-500'}`}>
                  {fmtDuration(entry.durationMs)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${colors.bar} ${isCurrent ? 'opacity-100' : 'opacity-50'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {entries.length > 1 && (
        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
          Total: {fmtDuration(totalMs)} since created
        </p>
      )}
    </div>
  )
}
