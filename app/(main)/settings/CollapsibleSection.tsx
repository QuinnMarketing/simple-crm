'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react'

export default function CollapsibleSection({
  title,
  description,
  ok,
  statusLabel,
  defaultOpen = false,
  children,
}: {
  title: string
  description: string
  ok?: boolean
  statusLabel?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`border rounded-xl overflow-hidden ${ok ? 'border-green-200' : 'border-slate-200'}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${ok ? 'bg-green-50/50 hover:bg-green-50' : 'bg-white hover:bg-slate-50'}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900 text-sm">{title}</span>
            {ok !== undefined && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                {ok
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                {statusLabel ?? (ok ? 'Active' : 'Inactive')}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-white px-6 py-6">
          {children}
        </div>
      )}
    </div>
  )
}
