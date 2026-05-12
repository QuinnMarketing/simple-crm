'use client'
import { useRef, useState } from 'react'
import { Download, Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type ImportResult = { created: number; skipped: number; errors: string[] }

export default function LeadsCsvButtons({ exportHref }: { exportHref: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImporting(true)
    setResult(null)
    setImportError(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/leads/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'Import failed'); return }
      setResult(data)
    } catch {
      setImportError('Network error — try again')
    } finally {
      setImporting(false)
    }
  }

  function dismiss() { setResult(null); setImportError(null) }

  return (
    <>
      <a
        href={exportHref}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        download
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export CSV</span>
      </a>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60"
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span className="hidden sm:inline">{importing ? 'Importing…' : 'Import CSV'}</span>
      </button>

      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

      {/* Result toast */}
      {(result || importError) && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm w-full rounded-xl shadow-lg border p-4 flex gap-3 ${
          importError ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {importError
              ? <AlertCircle className="w-5 h-5 text-red-500" />
              : <CheckCircle className="w-5 h-5 text-emerald-500" />}
          </div>
          <div className="flex-1 min-w-0">
            {importError ? (
              <p className="text-sm font-medium text-red-800">{importError}</p>
            ) : result && (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  Import complete — {result.created} lead{result.created !== 1 ? 's' : ''} created
                </p>
                {result.skipped > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">{result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped (no name)</p>
                )}
                {result.errors.length > 0 && (
                  <div className="mt-1.5">
                    <p className="text-xs font-medium text-red-600">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:</p>
                    <ul className="text-xs text-red-500 mt-0.5 space-y-0.5 max-h-24 overflow-y-auto">
                      {result.errors.map((e, i) => <li key={i} className="truncate">{e}</li>)}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-2 block"
                >
                  Refresh to see new leads →
                </button>
              </>
            )}
          </div>
          <button onClick={dismiss} className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  )
}
