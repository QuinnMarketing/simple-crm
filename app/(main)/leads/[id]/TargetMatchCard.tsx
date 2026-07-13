'use client'
import { useState } from 'react'
import { Crosshair, Loader2, RefreshCw } from 'lucide-react'

// "How well does this lead match your target customer?" — on-demand AI score
export default function TargetMatchCard({
  leadId,
  initialScore,
  initialSummary,
  initialScoredAt,
}: {
  leadId: string
  initialScore: number | null
  initialSummary: string | null
  initialScoredAt: string | null
}) {
  const [score, setScore] = useState<number | null>(initialScore)
  const [summary, setSummary] = useState<string | null>(initialSummary)
  const [scoredAt, setScoredAt] = useState<string | null>(initialScoredAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/leads/${leadId}/target-match`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setScore(data.targetMatchScore)
      setSummary(data.targetMatchSummary)
      setScoredAt(data.targetMatchAt)
    } else {
      setError(data.error ?? 'Scoring failed')
    }
    setBusy(false)
  }

  const tone =
    score == null ? '' :
    score >= 80 ? 'text-emerald-600' :
    score >= 50 ? 'text-amber-600' : 'text-rose-600'
  const ring =
    score == null ? 'border-slate-200' :
    score >= 80 ? 'border-emerald-200 bg-emerald-50/40' :
    score >= 50 ? 'border-amber-200 bg-amber-50/40' : 'border-rose-200 bg-rose-50/40'

  return (
    <div className={`rounded-xl border p-4 ${ring || 'border-slate-200'} bg-white`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide">
          <Crosshair className="w-3.5 h-3.5" /> Target match
        </p>
        {score != null && (
          <button onClick={run} disabled={busy} title="Re-score" className="text-slate-400 hover:text-indigo-600 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {score == null ? (
        <div>
          <p className="text-sm text-slate-500 mb-2">See how closely this lead matches your target customer.</p>
          <button onClick={run} disabled={busy}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Scoring…</> : 'Score this lead'}
          </button>
        </div>
      ) : (
        <div>
          <p className={`text-3xl font-bold ${tone}`}>{score}<span className="text-base font-medium text-slate-400">/100</span></p>
          {summary && <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{summary}</p>}
          {scoredAt && <p className="text-xs text-slate-400 mt-2">Scored {new Date(scoredAt).toLocaleDateString('en-AU')}</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
