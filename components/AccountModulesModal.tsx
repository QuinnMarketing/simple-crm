'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

type ModuleRow = { key: string; label: string; description: string; enabled: boolean }

export default function AccountModulesModal({
  accountId,
  accountName,
  onClose,
  onChanged,
}: {
  accountId: string
  accountName: string
  onClose: () => void
  onChanged?: (enabledKeys: string[]) => void
}) {
  const [rows, setRows] = useState<ModuleRow[] | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/accounts/${accountId}/modules`)
    if (res.ok) setRows((await res.json()).modules)
    else setError('Failed to load modules')
  }, [accountId])

  useEffect(() => { load() }, [load])

  async function toggle(row: ModuleRow) {
    setSavingKey(row.key)
    setError('')
    const res = await fetch(`/api/accounts/${accountId}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleKey: row.key, enabled: !row.enabled }),
    })
    if (res.ok) {
      const data = await res.json()
      setRows((prev) => prev?.map((r) => r.key === row.key ? { ...r, enabled: !r.enabled } : r) ?? null)
      onChanged?.(data.enabled)
    } else {
      setError('Failed to save — try again')
    }
    setSavingKey(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900">Modules</h2>
            <p className="text-xs text-slate-500 mt-0.5">{accountName} — switch features on or off</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="mx-5 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="p-5 overflow-y-auto space-y-2">
          {!rows ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            rows.map((row) => (
              <button
                key={row.key}
                onClick={() => toggle(row)}
                disabled={savingKey === row.key}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  row.enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{row.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>
                </div>
                {savingKey === row.key ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 flex-shrink-0" />
                ) : row.enabled ? (
                  <ToggleRight className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-300 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
