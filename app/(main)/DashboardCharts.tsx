'use client'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  BarChart, LabelList,
} from 'recharts'

export type DailyPoint = { day: string; leads: number; cumulative: number }
export type StageValue  = { stage: string; value: number; count: number; color: string }

interface Props {
  byStatus: Record<string, number>
  chartData: DailyPoint[]
  stageValues: StageValue[]
  totalPipelineValue: number
  wonValue: number
  chartLabel?: string
}

const DONUT_COLORS = ['#22c55e', '#ef4444', '#6366f1']

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function LeadsTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value}</span></p>
      ))}
    </div>
  )
}

function CustomBarTooltip({ active, payload }: { active?: boolean; payload?: { payload: StageValue }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-slate-700">{d.stage}</p>
      <p className="text-slate-600">Value: <span className="font-semibold">{fmt(d.value)}</span></p>
      <p className="text-slate-600">Leads: <span className="font-semibold">{d.count}</span></p>
    </div>
  )
}

export default function DashboardCharts({ byStatus, chartData, stageValues, totalPipelineValue, wonValue, chartLabel = '30 days' }: Props) {
  const won    = byStatus.won ?? 0
  const lost   = byStatus.lost ?? 0
  const active = (byStatus.new ?? 0) + (byStatus.contacted ?? 0) + (byStatus.qualified ?? 0)
  const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null

  const donutData = [
    { name: 'Won',    value: won,    color: '#22c55e' },
    { name: 'Lost',   value: lost,   color: '#ef4444' },
    { name: 'Active', value: active, color: '#6366f1' },
  ].filter((d) => d.value > 0)

  const hasValues = stageValues.some((s) => s.value > 0)

  // Show every Nth x-axis tick to avoid crowding
  const tickInterval = chartData.length > 60 ? 13 : chartData.length > 30 ? 6 : chartData.length > 14 ? 3 : 1

  return (
    <div className="space-y-4 mb-8">
      {/* Row 1: Win/Loss donut + Daily leads chart */}
      <div className="grid grid-cols-3 gap-4">
        {/* Win / Loss donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Win / Loss Ratio</p>
          {donutData.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No closed leads yet</p>
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color ?? DONUT_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {winRate !== null ? (
                  <>
                    <span className="text-2xl font-bold text-slate-900">{winRate}%</span>
                    <span className="text-xs text-slate-500">win rate</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">no data</span>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-slate-600">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leads over time — bar (daily) + line (cumulative) */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Leads Over Time ({chartLabel})</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval - 1}
              />
              {/* Left axis — daily count */}
              <YAxis
                yAxisId="left"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#6366f1' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              {/* Right axis — cumulative */}
              <YAxis
                yAxisId="right"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#0ea5e9' }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<LeadsTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar yAxisId="left" dataKey="leads" name="Daily" fill="#6366f1" opacity={0.85} radius={[2, 2, 0, 0]} maxBarSize={24} />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-1 justify-end">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block bg-indigo-500 opacity-85" />
              <span className="text-xs text-slate-500">Daily leads <span className="text-indigo-400">(left)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block bg-sky-500" />
              <span className="text-xs text-slate-500">Cumulative <span className="text-sky-400">(right)</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Pipeline value by stage */}
      {hasValues && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Deal Value by Stage</p>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>Pipeline: <span className="font-semibold text-slate-700">{fmt(totalPipelineValue)}</span></span>
              <span>Won: <span className="font-semibold text-green-600">{fmt(wonValue)}</span></span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={stageValues.filter((s) => s.value > 0).length * 52 + 20}>
            <BarChart
              data={stageValues.filter((s) => s.value > 0)}
              layout="vertical"
              margin={{ top: 0, right: 80, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => fmt(v)}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="stage"
                width={72}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={36}>
                {stageValues.filter((s) => s.value > 0).map((entry) => (
                  <Cell key={entry.stage} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: unknown) => fmt(Number(v))}
                  style={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
