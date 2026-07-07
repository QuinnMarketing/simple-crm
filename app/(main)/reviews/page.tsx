'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Star, CheckCircle2, EyeOff, MessageSquare, Trash2, Loader2, ChevronUp, Send, RefreshCw } from 'lucide-react'

type Review = {
  id: string
  reviewerName: string
  reviewerEmail: string | null
  rating: number
  body: string | null
  reply: string | null
  repliedAt: string | null
  status: string
  source: string
  createdAt: string
  lead: { id: string; name: string } | null
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-3.5 h-3.5 ${rating >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />
      ))}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

const STATUS_TABS = ['all', 'pending', 'approved', 'hidden'] as const
type StatusTab = typeof STATUS_TABS[number]

export default function ReviewsPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account')

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<StatusTab>('all')
  const [minRating, setMinRating] = useState<number>(0)
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [replying, setReplying] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (accountParam) qs.set('account', accountParam)
      if (tab !== 'all') qs.set('status', tab)
      if (minRating > 0) qs.set('rating', String(minRating))
      const r = await fetch(`/api/reviews?${qs}`)
      if (r.ok) setReviews(await r.json())
    } finally {
      setLoading(false)
    }
  }, [tab, minRating, accountParam])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  async function patch(id: string, data: object) {
    setActioning(id)
    try {
      const r = await fetch(`/api/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, accountParam }),
      })
      if (r.ok) {
        const updated = await r.json()
        setReviews((prev) => prev.map((rv) => rv.id === id ? updated : rv))
      }
    } finally {
      setActioning(null)
    }
  }

  async function syncGoogle() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await fetch('/api/reviews/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountParam }),
      })
      const data = await r.json()
      if (!r.ok) {
        setSyncMsg(data.error ?? 'Sync failed')
      } else {
        const parts = [`${data.created} new`, `${data.updated} updated`]
        if (data.autoReplied > 0) parts.push(`${data.autoReplied} auto-replied`)
        // Surface the first actual error — a bare "(1 error)" is undiagnosable
        const errDetail = data.errors?.length ? ` — ${data.errors[0]}${data.errors.length > 1 ? ` (+${data.errors.length - 1} more)` : ''}` : ''
        setSyncMsg(`Synced: ${parts.join(', ')}${errDetail}`)
        fetchReviews()
      }
    } finally {
      setSyncing(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this review?')) return
    setActioning(id)
    await fetch(`/api/reviews/${id}`, { method: 'DELETE' })
    setReviews((prev) => prev.filter((rv) => rv.id !== id))
    setActioning(null)
  }

  async function submitReply(id: string, email: string | null) {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      await patch(id, { reply: replyText, sendReplyEmail: sendEmail && !!email })
      setReplyOpen(null)
      setReplyText('')
    } finally {
      setReplying(false)
    }
  }

  // Counts per tab
  const counts = {
    all: reviews.length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    hidden: reviews.filter((r) => r.status === 'hidden').length,
  }

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
          <p className="text-slate-500 text-sm mt-1">Customer reviews from your widget and Google Business Profile.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {syncMsg && <span className={`text-xs ${syncMsg.includes('error') || syncMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>{syncMsg}</span>}
          <button
            onClick={syncGoogle}
            disabled={syncing}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Google Reviews
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: reviews.length },
          { label: 'Average Rating', value: avgRating },
          { label: 'Pending', value: counts.pending },
          { label: 'Approved', value: counts.approved },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + rating filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t} {t !== 'all' ? `(${counts[t]})` : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium">Min rating:</span>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setMinRating(n)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  minRating === n
                    ? 'bg-amber-400 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {n === 0 ? 'All' : `${n}★+`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Star className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No reviews yet</p>
          <p className="text-slate-400 text-xs mt-1">Share your review link to start collecting feedback</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const isActioning = actioning === review.id
            const isReplyOpen = replyOpen === review.id

            return (
              <div key={review.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{review.reviewerName}</span>
                      <Stars rating={review.rating} />
                      <span className="text-xs text-slate-400">{timeAgo(review.createdAt)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        review.status === 'approved' ? 'bg-green-50 text-green-700' :
                        review.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {review.status}
                      </span>
                      {review.source === 'google' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex items-center gap-1">
                          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                          Google
                        </span>
                      )}
                      {review.source === 'manual' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">manual</span>
                      )}
                    </div>
                    {review.reviewerEmail && (
                      <p className="text-xs text-slate-400 mt-0.5">{review.reviewerEmail}</p>
                    )}
                    {review.lead && (
                      <p className="text-xs text-slate-400 mt-0.5">Lead: <a href={`/leads/${review.lead.id}`} className="text-indigo-600 hover:underline">{review.lead.name}</a></p>
                    )}
                    {review.body && (
                      <p className="text-slate-700 text-sm mt-2 leading-relaxed">{review.body}</p>
                    )}

                    {/* Existing reply */}
                    {review.reply && (
                      <div className="mt-3 pl-3 border-l-2 border-indigo-200 bg-indigo-50 rounded-r-lg py-2 px-3">
                        <p className="text-xs font-semibold text-indigo-700 mb-1">Your reply</p>
                        <p className="text-sm text-slate-700">{review.reply}</p>
                      </div>
                    )}

                    {/* Inline reply form */}
                    {isReplyOpen && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={3}
                          placeholder="Write your reply…"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                          autoFocus
                        />
                        {review.reviewerEmail && (
                          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded" />
                            Send reply by email to {review.reviewerEmail}
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitReply(review.id, review.reviewerEmail)}
                            disabled={replying || !replyText.trim()}
                            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                          >
                            {replying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Save reply
                          </button>
                          <button
                            onClick={() => { setReplyOpen(null); setReplyText('') }}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {review.status !== 'approved' && (
                      <button
                        onClick={() => patch(review.id, { status: 'approved' })}
                        disabled={isActioning}
                        title="Approve"
                        className="p-1.5 text-slate-400 hover:text-green-600 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {review.status !== 'hidden' && (
                      <button
                        onClick={() => patch(review.id, { status: 'hidden' })}
                        disabled={isActioning}
                        title="Hide"
                        className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (isReplyOpen) { setReplyOpen(null); setReplyText('') }
                        else { setReplyOpen(review.id); setReplyText(review.reply ?? ''); setSendEmail(true) }
                      }}
                      title="Reply"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {isReplyOpen ? <ChevronUp className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => del(review.id)}
                      disabled={isActioning}
                      title="Delete"
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isActioning && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
