'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

type Message = {
  id: string
  sender: 'visitor' | 'staff'
  senderName: string | null
  body: string
  createdAt: string
}

type Stored = { conversationId: string; token: string; name: string }

const POLL_MS = 3500

export default function ChatWidget({ slug, businessName }: { slug: string; businessName: string }) {
  const storageKey = `scrm-chat-${slug}`
  const [session, setSession] = useState<Stored | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Pre-chat form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [starting, setStarting] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setSession(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [storageKey])

  const poll = useCallback(async (s: Stored) => {
    try {
      const res = await fetch(`/api/chat/${slug}/messages?conversation=${s.conversationId}&token=${s.token}`)
      if (res.status === 404) {
        // Conversation gone (deleted server-side) — reset to the pre-chat form
        localStorage.removeItem(storageKey)
        setSession(null)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
      }
    } catch { /* transient network error — next poll retries */ }
  }, [slug, storageKey])

  useEffect(() => {
    if (!session) return
    poll(session)
    const timer = setInterval(() => poll(session), POLL_MS)
    return () => clearInterval(timer)
  }, [session, poll])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  async function start(e: React.FormEvent) {
    e.preventDefault()
    if (starting) return
    setStarting(true)
    setError('')
    try {
      const res = await fetch(`/api/chat/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), message: firstMessage.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const s: Stored = { conversationId: data.conversationId, token: data.token, name: name.trim() }
      localStorage.setItem(storageKey, JSON.stringify(s))
      setSession(s)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not start chat — please try again')
    } finally {
      setStarting(false)
    }
  }

  async function send() {
    if (!session || !draft.trim() || sending) return
    setSending(true)
    const text = draft.trim()
    setDraft('')
    // Optimistic append
    setMessages(m => [...m, { id: `tmp-${Date.now()}`, sender: 'visitor', senderName: session.name, body: text, createdAt: new Date().toISOString() }])
    try {
      await fetch(`/api/chat/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: session.conversationId, token: session.token, body: text }),
      })
    } catch { /* poll will reconcile */ }
    setSending(false)
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {businessName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{businessName}</p>
          <p className="text-xs text-slate-400">Typically replies within the hour</p>
        </div>
      </div>

      {!session ? (
        // Pre-chat form
        <form onSubmit={start} className="flex-1 flex flex-col justify-center p-5 space-y-3 overflow-y-auto">
          <p className="text-sm text-slate-600 mb-1">Hi 👋 Leave your details and we&apos;ll be right with you.</p>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone <span className="text-slate-400">(so we can call you back)</span></label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">How can we help?</label>
            <textarea rows={3} value={firstMessage} onChange={e => setFirstMessage(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={starting} className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {starting ? 'Starting…' : 'Start Chat'}
          </button>
        </form>
      ) : (
        <>
          {/* Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
            {messages.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6">You&apos;re connected — say hello!</p>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.sender === 'visitor' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                  {m.sender === 'staff' && m.senderName && <p className="text-[10px] font-semibold text-slate-400 mb-0.5">{m.senderName}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-slate-200 flex items-end gap-2 flex-shrink-0">
            <textarea
              rows={1}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Type a message…"
              className="flex-1 resize-none px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              aria-label="Send"
              className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
