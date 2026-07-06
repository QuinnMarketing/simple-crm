'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MessagesSquare, Loader2, Send, UserPlus, ExternalLink, Check, Copy, Code, CheckCircle2, RotateCcw } from 'lucide-react'

type Conversation = {
  id: string
  visitorName: string
  visitorPhone: string | null
  visitorEmail: string | null
  status: string
  leadId: string | null
  lastMessageAt: string
  lastMessage: string
  unread: number
}

type Message = {
  id: string
  sender: string
  senderName: string | null
  body: string
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function LiveChatPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [copied, setCopied] = useState(false)
  const [embedSlug, setEmbedSlug] = useState<string | null>(null)
  const [creatingLead, setCreatingLead] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchList = useCallback(async () => {
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/live-chat${qs}`)
    if (res.ok) setConversations(await res.json())
    setLoading(false)
  }, [accountParam])

  const fetchThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/live-chat/${id}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
      // Reading the thread clears its unread count
      setConversations(cs => cs.map(c => c.id === id ? { ...c, unread: 0 } : c))
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => {
    const timer = setInterval(fetchList, 6000)
    return () => clearInterval(timer)
  }, [fetchList])

  useEffect(() => {
    const qs = accountParam ? `?account=${accountParam}` : ''
    fetch(`/api/live-chat/embed${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setEmbedSlug(d?.slug ?? null))
      .catch(() => {})
  }, [accountParam])

  useEffect(() => {
    if (!activeId) return
    setThreadLoading(true)
    fetchThread(activeId).finally(() => setThreadLoading(false))
    const timer = setInterval(() => fetchThread(activeId), 4000)
    return () => clearInterval(timer)
  }, [activeId, fetchThread])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  const active = conversations.find(c => c.id === activeId) ?? null

  async function reply() {
    if (!activeId || !draft.trim() || sending) return
    setSending(true)
    const text = draft.trim()
    setDraft('')
    setMessages(m => [...m, { id: `tmp-${Date.now()}`, sender: 'staff', senderName: 'You', body: text, createdAt: new Date().toISOString() }])
    await fetch(`/api/live-chat/${activeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    }).catch(() => {})
    setSending(false)
  }

  async function setStatus(status: 'open' | 'closed') {
    if (!activeId) return
    const res = await fetch(`/api/live-chat/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setConversations(cs => cs.map(c => c.id === activeId ? { ...c, status } : c))
  }

  async function createLead() {
    if (!activeId || creatingLead) return
    setCreatingLead(true)
    const res = await fetch(`/api/live-chat/${activeId}/create-lead`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setConversations(cs => cs.map(c => c.id === activeId ? { ...c, leadId: data.lead.id } : c))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Failed to create lead')
    }
    setCreatingLead(false)
  }

  function copySnippet() {
    const snippet = `<script src="${window.location.origin}/api/chat/widget?slug=${embedSlug ?? 'YOUR_ACCOUNT_SLUG'}" async></script>`
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Chat</h1>
          <p className="text-slate-500 mt-1 text-sm">Chats from your website widget — visitors with contact details become leads automatically</p>
        </div>
        <button
          onClick={() => setShowInstall(!showInstall)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Code className="w-4 h-4" /> Install widget
        </button>
      </div>

      {showInstall && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          {embedSlug ? (
            <>
              <p className="text-sm text-slate-600 mb-3">Paste this before the closing <code className="bg-slate-100 px-1 rounded">&lt;/body&gt;</code> tag on any website — it&apos;s ready to go for this account.</p>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <code className="text-xs font-mono text-slate-700 flex-1 break-all">
                  {`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/chat/widget?slug=${embedSlug}" async></script>`}
                </code>
                <button onClick={copySnippet} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 flex-shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
              <a
                href={`/chat/${embedSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <ExternalLink className="w-4 h-4" /> Open your chat page to test it
              </a>
            </>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Select an account from the sidebar first — the install snippet is generated per account.
            </p>
          )}
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <MessagesSquare className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium text-slate-600">No chats yet</p>
          <p className="text-sm mt-1">Install the widget on your website to start receiving chats</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 grid md:grid-cols-[320px_1fr] overflow-hidden" style={{ minHeight: '60vh' }}>
          {/* Conversation list */}
          <div className="border-r border-slate-100 overflow-y-auto max-h-[70vh]">
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-50 transition-colors ${activeId === c.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${c.unread > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{c.visitorName}</p>
                  <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-xs truncate ${c.unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{c.lastMessage || 'No messages'}</p>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {c.status === 'closed' && <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">closed</span>}
                    {c.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{c.unread}</span>}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Thread */}
          <div className="flex flex-col max-h-[70vh]">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a conversation</div>
            ) : (
              <>
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{active.visitorName}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {[active.visitorPhone, active.visitorEmail].filter(Boolean).join(' · ') || 'No contact details'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {active.leadId ? (
                      <Link href={`/leads/${active.leadId}`} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                        <ExternalLink className="w-3.5 h-3.5" /> View lead
                      </Link>
                    ) : (
                      <button onClick={createLead} disabled={creatingLead} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50">
                        {creatingLead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Create lead
                      </button>
                    )}
                    {active.status === 'open' ? (
                      <button onClick={() => setStatus('closed')} className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Close
                      </button>
                    ) : (
                      <button onClick={() => setStatus('open')} className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                        <RotateCcw className="w-3.5 h-3.5" /> Reopen
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                  {threadLoading && messages.length === 0 ? (
                    <div className="flex justify-center py-8 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /></div>
                  ) : (
                    messages.map(m => (
                      <div key={m.id} className={`flex ${m.sender === 'staff' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.sender === 'staff' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`text-[10px] mt-1 ${m.sender === 'staff' ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {new Date(m.createdAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
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
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply() } }}
                    placeholder="Type a reply…"
                    className="flex-1 resize-none px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={reply}
                    disabled={sending || !draft.trim()}
                    className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
