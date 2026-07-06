'use client'
import { useState, useEffect } from 'react'
import { X, Send, Loader2, AlertCircle, Paperclip, CheckSquare } from 'lucide-react'

interface Props {
  leadId: string
  leadEmail: string | null
  leadName: string
  quoteId?: string
  quoteNumber?: string
  onClose: () => void
  onSent?: () => void
}

export default function EmailModal({ leadId, leadEmail, leadName, quoteId, quoteNumber, onClose, onSent }: Props) {
  const isQuote = !!quoteId && !!quoteNumber
  const [to, setTo] = useState(leadEmail ?? '')
  const [subject, setSubject] = useState(isQuote ? `Your ${quoteNumber}` : '')
  const [body, setBody] = useState(
    isQuote
      ? `Hi ${leadName},\n\nPlease find your ${quoteNumber} attached.\n\nPlease don't hesitate to reach out if you have any questions.\n\nKind regards`
      : `Hi ${leadName},\n\n`
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [smtpStatus, setSmtpStatus] = useState<'checking' | 'ok' | 'missing'>('checking')

  useEffect(() => {
    fetch(`/api/leads/${leadId}/email`)
      .then((r) => r.json())
      .then((d) => setSmtpStatus(d.smtpEnabled ? 'ok' : 'missing'))
      .catch(() => setSmtpStatus('missing'))
  }, [leadId])

  async function send() {
    if (!to.trim()) { setError('Email address required'); return }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body, quoteId }),
      })
      if (res.ok) {
        onSent?.()
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? `Error ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSending(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-900">{isQuote ? `Email ${quoteNumber}` : 'Send Email'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {smtpStatus === 'checking' && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking email configuration…
            </div>
          )}
          {smtpStatus === 'missing' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                SMTP not configured.{' '}
                <a href="/settings" className="font-medium underline hover:text-amber-900">
                  Set up email in Settings → Integrations
                </a>.
              </span>
            </div>
          )}

          <div>
            <label className={labelCls}>To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
              placeholder="recipient@email.com"
              autoFocus={smtpStatus === 'ok'}
            />
          </div>

          <div>
            <label className={labelCls}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputCls}
              placeholder="Subject…"
            />
          </div>

          <div>
            <label className={labelCls}>Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className={`${inputCls} resize-none font-mono text-xs leading-relaxed`}
            />
          </div>

          {isQuote && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                <Paperclip className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span><span className="font-medium text-slate-700">{quoteNumber}.pdf</span> will be attached</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-200">
                <CheckSquare className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                <span><span className="font-medium">Accept / Decline buttons</span> will be included — clicking either updates the quote status automatically.</span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending || smtpStatus !== 'ok' || !to.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
