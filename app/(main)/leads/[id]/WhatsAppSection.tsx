'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageCircle, Send, Loader2, AlertCircle } from 'lucide-react'

type WaMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  error: string | null
  createdAt: string
}

export default function WhatsAppSection({ leadId }: { leadId: string }) {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchThread = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/whatsapp`)
    if (res.ok) {
      const data = await res.json()
      setConnected(data.connected)
      setMessages(data.messages)
    }
    setLoading(false)
  }, [leadId])

  useEffect(() => { fetchThread() }, [fetchThread])
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages])

  async function send() {
    if (!draft.trim() || sending) return
    setSending(true)
    setSendError('')
    const res = await fetch(`/api/leads/${leadId}/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessages((m) => [...m, data.message])
      setDraft('')
    } else {
      setSendError(data.error ?? 'Failed to send')
      if (data.message) setMessages((m) => [...m, data.message])
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-center h-32 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-slate-900 text-sm">WhatsApp</h3>
        {!connected && (
          <span className="text-xs text-slate-400 ml-auto">Not connected — set up in Settings → Integrations</span>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No messages yet</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.direction === 'outbound'
                    ? m.status === 'failed' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-800 border border-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.status === 'failed' && m.error && (
                  <p className="text-xs mt-1 flex items-center gap-1 opacity-90"><AlertCircle className="w-3 h-3" /> {m.error}</p>
                )}
                <p className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {new Date(m.createdAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-slate-100 flex items-end gap-2">
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={connected ? 'Type a message…' : 'Connect WhatsApp in Settings to send messages'}
          disabled={!connected || sending}
          className="flex-1 resize-none px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
        />
        <button
          onClick={send}
          disabled={!connected || sending || !draft.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {sendError && <p className="px-3 pb-3 text-xs text-red-600">{sendError}</p>}
    </div>
  )
}
