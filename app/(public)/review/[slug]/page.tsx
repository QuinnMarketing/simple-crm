'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, Star } from 'lucide-react'

type Info = { title: string; description: string | null; accountName: string }

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-9 h-9 transition-colors ${(hovered || value) >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
          />
        </button>
      ))}
    </div>
  )
}

export default function ReviewPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [info, setInfo] = useState<Info | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [rating, setRating] = useState(0)
  const [form, setForm] = useState({ name: '', email: '', body: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/review/${slug}/list`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return }
        const data = await r.json()
        setInfo({ title: data.title, description: data.description, accountName: data.accountName })
      })
      .catch(() => setNotFound(true))
  }, [slug])

  async function submit() {
    if (!rating) { setError('Please select a star rating.'); return }
    if (!form.name.trim()) { setError('Please enter your name.'); return }
    setError('')
    setSubmitting(true)
    try {
      const r = await fetch(`/api/review/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerName: form.name, reviewerEmail: form.email, rating, body: form.body }),
      })
      if (r.ok) setDone(true)
      else setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <p className="text-slate-500 text-lg font-medium">Review page not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        <div className="bg-indigo-600 px-6 py-5">
          <h1 className="text-white font-bold text-xl">{info?.title ?? 'Leave a Review'}</h1>
          {info?.description && <p className="text-indigo-200 text-sm mt-1">{info.description}</p>}
          {info?.accountName && <p className="text-indigo-300 text-xs mt-2">{info.accountName}</p>}
        </div>

        <div className="p-6">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Thank you!</h2>
              <p className="text-slate-500 text-sm">Your review has been submitted.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Your rating <span className="text-red-500">*</span></p>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(optional — for our response)</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your review</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={4}
                  placeholder="Tell us about your experience…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit Review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
