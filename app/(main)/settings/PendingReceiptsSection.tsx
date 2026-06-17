'use client'
import { useState, useEffect } from 'react'
import { Loader2, Trash2, Check, AlertCircle } from 'lucide-react'

type PendingReceipt = {
  id: string
  fileName: string
  imageUrl: string
  amount: number | null
  vendor: string | null
  date: string | null
  ocrData: string | null
  notes: string | null
  createdAt: string
}

type Project = {
  id: string
  name: string
}

interface PendingReceiptsSectionProps {
  projects: Project[]
}

export default function PendingReceiptsSection({ projects }: PendingReceiptsSectionProps) {
  const [receipts, setReceipts] = useState<PendingReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pending-receipts')
      if (res.ok) {
        const data = await res.json()
        setReceipts(data)
      }
    } catch (err) {
      console.error('Failed to fetch receipts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReceipts()
  }, [])

  const handleAssign = async (receiptId: string) => {
    const projectId = selectedProject[receiptId]
    if (!projectId) return

    setAssigningId(receiptId)
    try {
      const res = await fetch('/api/pending-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          projectId,
          notes: notes[receiptId] || undefined,
        }),
      })

      if (res.ok) {
        setReceipts(receipts.filter((r) => r.id !== receiptId))
        setSelectedProject((prev) => {
          const newState = { ...prev }
          delete newState[receiptId]
          return newState
        })
        setNotes((prev) => {
          const newState = { ...prev }
          delete newState[receiptId]
          return newState
        })
      }
    } catch (err) {
      console.error('Failed to assign receipt:', err)
    } finally {
      setAssigningId(null)
    }
  }

  const handleDelete = async (receiptId: string) => {
    if (!confirm('Delete this receipt?')) return

    try {
      const res = await fetch(`/api/pending-receipts/${receiptId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setReceipts(receipts.filter((r) => r.id !== receiptId))
      }
    } catch (err) {
      console.error('Failed to delete receipt:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Pending Receipts</h3>
          <p className="text-sm text-slate-600 mt-1">
            Receipts submitted via email. Review and assign to projects to create expenses.
          </p>
        </div>
        {receipts.length > 0 && (
          <div className="text-sm font-semibold text-slate-700 bg-yellow-100 px-3 py-1 rounded-full">
            {receipts.length}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
          <AlertCircle className="w-10 h-10 mb-3 opacity-50" />
          <p className="font-medium">No pending receipts</p>
          <p className="text-sm mt-1">Email receipts to your account address to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm break-words">{receipt.fileName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(receipt.createdAt).toLocaleDateString('en-AU')}
                  </p>
                </div>
                {receipt.imageUrl && (
                  <a
                    href={receipt.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-xs font-medium flex-shrink-0"
                  >
                    View
                  </a>
                )}
              </div>

              {/* OCR extracted data */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                {receipt.amount && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Amount:</span>
                    <span className="font-semibold text-slate-900">
                      ${receipt.amount.toFixed(2)}
                    </span>
                  </div>
                )}
                {receipt.vendor && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Vendor:</span>
                    <span className="text-slate-900">{receipt.vendor}</span>
                  </div>
                )}
                {receipt.date && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date:</span>
                    <span className="text-slate-900">
                      {new Date(receipt.date).toLocaleDateString('en-AU')}
                    </span>
                  </div>
                )}
              </div>

              {/* Assignment form */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assign to Project
                  </label>
                  <select
                    value={selectedProject[receipt.id] || ''}
                    onChange={(e) =>
                      setSelectedProject((prev) => ({
                        ...prev,
                        [receipt.id]: e.target.value,
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={notes[receipt.id] || ''}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [receipt.id]: e.target.value,
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Materials for main job"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAssign(receipt.id)}
                    disabled={!selectedProject[receipt.id] || assigningId === receipt.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {assigningId === receipt.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Assign
                  </button>
                  <button
                    onClick={() => handleDelete(receipt.id)}
                    className="px-3 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
