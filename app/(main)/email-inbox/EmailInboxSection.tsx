'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, Inbox, UserPlus, X } from 'lucide-react'

type SyncedEmail = {
  id: string
  provider: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  snippet: string
  sentAt: string
}

const PROVIDER_LABELS: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook' }

export default function EmailInboxSection() {
  const [emails, setEmails] = useState<SyncedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null)

  const fetchEmails = useCallback(async () => {
    const res = await fetch('/api/email-inbox')
    if (res.ok) setEmails(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmails() }, [fetchEmails])

  async function createLead(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/email-inbox/${id}/create-lead`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setEmails((e) => e.filter((x) => x.id !== id))
      setCreatedLeadId(data.lead.id)
    } else {
      alert(data.error ?? 'Failed to create lead')
    }
    setBusyId(null)
  }

  async function dismiss(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/email-inbox/${id}`, { method: 'DELETE' })
    if (res.ok) setEmails((e) => e.filter((x) => x.id !== id))
    setBusyId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Unmatched Emails</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Synced from Gmail/Outlook — sender doesn't match an existing lead. Create a lead or dismiss.
        </p>
      </div>

      {createdLeadId && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mb-4 text-sm">
          <span className="text-emerald-800">Lead created successfully.</span>
          <div className="flex items-center gap-3">
            <Link href={`/leads/${createdLeadId}`} className="text-emerald-700 font-medium hover:underline">View lead →</Link>
            <button onClick={() => setCreatedLeadId(null)} className="text-emerald-600 hover:text-emerald-800"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Inbox className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No unmatched emails</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {emails.map((e) => (
            <div key={e.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900">{e.fromName || e.fromEmail}</p>
                    <span className="text-xs text-slate-400">{e.fromEmail}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{PROVIDER_LABELS[e.provider] ?? e.provider}</span>
                  </div>
                  {e.subject && <p className="text-sm text-slate-700 mt-1 font-medium truncate">{e.subject}</p>}
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{e.snippet}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(e.sentAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => createLead(e.id)}
                    disabled={busyId === e.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {busyId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    Create Lead
                  </button>
                  <button
                    onClick={() => dismiss(e.id)}
                    disabled={busyId === e.id}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 px-2 py-1.5 disabled:opacity-50"
                  >
                    Dismiss
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
