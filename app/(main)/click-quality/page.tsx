'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, ShieldBan, AlertTriangle, CheckCircle2, RefreshCw, Info, Ban } from 'lucide-react'

type SharedRisk = 'none' | 'low' | 'medium' | 'high'
type Assessment = {
  botRatio: number
  sharedRisk: SharedRisk
  flags: string[]
  safeToBlock: boolean
  recommendation: string
}
type Row = {
  ip: string
  totalVisits: number
  botVisits: number
  humanVisits: number
  distinctUserAgents: number
  distinctPaths: number
  paidVisits: number
  firstSeen: string
  lastSeen: string
  sites: string[]
  assessment: Assessment
  blocked: { status: string; error: string | null; at: string } | null
}
type Report = {
  rows: Row[]
  summary: {
    totalVisits: number; botVisits: number; distinctIps: number
    blockCandidates: number; sharedFlagged: number; alreadyBlocked: number
  }
  sites: string[]
  days: number
  thresholdMs: number
}

const RISK_STYLE: Record<SharedRisk, string> = {
  none: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-red-50 text-red-700 border-red-200',
}
const RISK_LABEL: Record<SharedRisk, string> = {
  none: 'Not shared', low: 'Low', medium: 'Possibly shared', high: 'Shared — do not block',
}

export default function ClickQualityPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [site, setSite] = useState('')
  const [paidOnly, setPaidOnly] = useState(true)
  const [busyIp, setBusyIp] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ days: String(days), ...(site ? { site } : {}), ...(paidOnly ? { paidOnly: '1' } : {}) })
    const res = await fetch(`/api/click-quality?${params}`)
    if (res.ok) setReport(await res.json())
    setLoading(false)
  }, [days, site, paidOnly])

  useEffect(() => { load() }, [load])

  async function block(row: Row, force = false) {
    if (row.assessment.sharedRisk === 'high' && !force) {
      const ok = confirm(
        `This IP looks SHARED, not a single bot:\n\n` +
        row.assessment.flags.map(f => `• ${f}`).join('\n') +
        `\n\nBlocking it may stop real customers from seeing your ads. Block anyway?`
      )
      if (!ok) return
      force = true
    }
    setBusyIp(row.ip)
    setMessage(null)
    const res = await fetch('/api/click-quality/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: row.ip, force }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage({ kind: 'ok', text: `Blocked ${row.ip} across ${data.campaignsAdded}/${data.campaignsTargeted} campaigns.` })
      await load()
    } else {
      setMessage({ kind: 'err', text: data.error ?? 'Block failed' })
    }
    setBusyIp(null)
  }

  const s = report?.summary
  const thresholdSec = (report?.thresholdMs ?? 2000) / 1000

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <ShieldBan className="w-6 h-6" /> Click Quality
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Landing-page sessions under {thresholdSec}s are unlikely to be genuine enquiries.
            Repeat offenders can be excluded in Google Ads — but check the shared-connection flags first.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5 text-sm">
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-1.5">
          {[7, 14, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        <select value={site} onChange={e => setSite(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5">
          <option value="">All sites</option>
          {report?.sites.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 px-3 py-1.5">
          <input type="checkbox" checked={paidOnly} onChange={e => setPaidOnly(e.target.checked)} />
          Paid clicks only (has gclid)
        </label>
      </div>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Visits', value: s.totalVisits },
            { label: `Under ${thresholdSec}s`, value: s.botVisits },
            { label: 'Distinct IPs', value: s.distinctIps },
            { label: 'Safe to block', value: s.blockCandidates },
            { label: 'Shared — protected', value: s.sharedFlagged },
          ].map(c => (
            <div key={c.label} className="border border-slate-200 rounded-xl p-3">
              <div className="text-xs text-slate-500">{c.label}</div>
              <div className="text-xl font-semibold text-slate-900">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className={`mb-4 text-sm px-3 py-2 rounded-lg border ${message.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : !report?.rows.length ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          No visit data yet. Once the tracking snippet is live on the landing pages, IPs will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">IP address</th>
                <th className="text-right px-3 py-2 font-medium">Visits</th>
                <th className="text-right px-3 py-2 font-medium">Under {thresholdSec}s</th>
                <th className="text-right px-3 py-2 font-medium">Engaged</th>
                <th className="text-right px-3 py-2 font-medium">Devices</th>
                <th className="text-left px-3 py-2 font-medium">Shared risk</th>
                <th className="text-right px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map(r => {
                const pct = Math.round(r.assessment.botRatio * 100)
                return (
                  <tr key={r.ip} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-900">{r.ip}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{r.assessment.recommendation}</div>
                      {r.assessment.flags.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {r.assessment.flags.map(f => (
                            <li key={f} className="text-xs text-amber-700 flex items-start gap-1">
                              <Info className="w-3 h-3 mt-0.5 shrink-0" />{f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.totalVisits}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold text-slate-900">{r.botVisits}</span>
                      <span className="text-xs text-slate-500 ml-1">({pct}%)</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.humanVisits}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.distinctUserAgents}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${RISK_STYLE[r.assessment.sharedRisk]}`}>
                        {RISK_LABEL[r.assessment.sharedRisk]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.blocked ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          {r.blocked.status === 'synced'
                            ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Blocked</>
                            : <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {r.blocked.status}</>}
                        </span>
                      ) : (
                        <button
                          onClick={() => block(r)}
                          disabled={busyIp === r.ip}
                          title={r.assessment.recommendation}
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium disabled:opacity-50 ${
                            r.assessment.safeToBlock
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {busyIp === r.ip
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Ban className="w-3.5 h-3.5" />}
                          Block IP
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
