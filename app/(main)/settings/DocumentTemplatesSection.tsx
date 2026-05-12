'use client'
import { useState, useEffect, useRef } from 'react'
import { FileText, Upload, Trash2, Loader2, CheckCircle } from 'lucide-react'

type Template = { id: string; type: string; filename: string; updatedAt: string }

export default function DocumentTemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const quoteRef = useRef<HTMLInputElement>(null)
  const invoiceRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/templates').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setTemplates(d) })
  }, [])

  async function upload(type: 'quote' | 'invoice', file: File) {
    setUploading((s) => ({ ...s, [type]: true }))
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    const res = await fetch('/api/templates', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setTemplates((prev) => {
        const filtered = prev.filter((t) => t.type !== type)
        return [...filtered, data]
      })
    } else {
      setError(data.error ?? 'Upload failed')
    }
    setUploading((s) => ({ ...s, [type]: false }))
  }

  async function remove(id: string, type: string) {
    setDeleting((s) => ({ ...s, [id]: true }))
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    setDeleting((s) => ({ ...s, [id]: false }))
  }

  function quoteTemplate() { return templates.find((t) => t.type === 'quote') ?? null }
  function invoiceTemplate() { return templates.find((t) => t.type === 'invoice') ?? null }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="font-semibold text-slate-900">Document Templates</h2>
      </div>
      <p className="text-slate-500 text-sm mb-5">
        Upload a <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">.docx</code> file as a template for quotes and invoices.
        Use these placeholders in your document:
      </p>

      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-5 text-xs font-mono text-slate-600 space-y-1">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <span><span className="text-indigo-600">{'{number}'}</span> — e.g. Q-001</span>
          <span><span className="text-indigo-600">{'{type}'}</span> — Quote or Invoice</span>
          <span><span className="text-indigo-600">{'{status}'}</span> — draft, sent…</span>
          <span><span className="text-indigo-600">{'{issued_date}'}</span> — formatted date</span>
          <span><span className="text-indigo-600">{'{due_date}'}</span> — formatted date</span>
          <span><span className="text-indigo-600">{'{account_name}'}</span> — your business name</span>
          <span><span className="text-indigo-600">{'{client_name}'}</span> — lead name</span>
          <span><span className="text-indigo-600">{'{client_email}'}</span></span>
          <span><span className="text-indigo-600">{'{client_phone}'}</span></span>
          <span><span className="text-indigo-600">{'{client_address}'}</span></span>
          <span><span className="text-indigo-600">{'{service}'}</span></span>
          <span><span className="text-indigo-600">{'{notes}'}</span></span>
          <span><span className="text-indigo-600">{'{subtotal}'}</span></span>
          <span><span className="text-indigo-600">{'{tax_rate}'}</span> — e.g. 10%</span>
          <span><span className="text-indigo-600">{'{tax_amount}'}</span></span>
          <span><span className="text-indigo-600">{'{total}'}</span></span>
        </div>
        <div className="pt-2 border-t border-slate-200 mt-2">
          <p className="text-slate-500 mb-1">For line items, add a table row with these in each cell and wrap in a loop:</p>
          <p>
            <span className="text-emerald-600">{'{#items}'}</span>
            {'  '}<span className="text-indigo-600">{'{description}'}</span>
            {'  '}<span className="text-indigo-600">{'{qty}'}</span>
            {'  '}<span className="text-indigo-600">{'{unit_price}'}</span>
            {'  '}<span className="text-indigo-600">{'{line_total}'}</span>
            {'  '}<span className="text-emerald-600">{'{/items}'}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['quote', 'invoice'] as const).map((type) => {
          const tpl = type === 'quote' ? quoteTemplate() : invoiceTemplate()
          const ref = type === 'quote' ? quoteRef : invoiceRef
          const busy = uploading[type]

          return (
            <div key={type} className="border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-800 capitalize mb-3">{type} Template</p>

              {tpl ? (
                <div className="flex items-center gap-3 mb-3 p-3 bg-slate-50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{tpl.filename}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Updated {new Date(tpl.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(tpl.id, tpl.type)}
                    disabled={deleting[tpl.id]}
                    className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    {deleting[tpl.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-5 border border-dashed border-slate-200 rounded-lg mb-3 text-slate-400">
                  <FileText className="w-7 h-7 mb-1.5 opacity-40" />
                  <p className="text-xs">No template uploaded</p>
                </div>
              )}

              <input
                ref={ref}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload(type, file)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => ref.current?.click()}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {tpl ? 'Replace template' : 'Upload .docx'}
              </button>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
