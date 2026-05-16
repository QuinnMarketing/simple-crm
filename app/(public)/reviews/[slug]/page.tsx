'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, Loader2 } from 'lucide-react'

type Review = {
  id: string
  reviewerName: string
  rating: number
  body: string | null
  reply: string | null
  repliedAt: string | null
  createdAt: string
}

type Data = {
  accountName: string
  title: string
  description: string | null
  averageRating: number
  totalReviews: number
  reviews: Review[]
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${cls} ${rating >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />
      ))}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`
}

export default function ReviewsWidget() {
  const params = useParams<{ slug: string }>()
  const [data, setData] = useState<Data | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/review/${params.slug}/list`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return }
        setData(await r.json())
      })
      .catch(() => setNotFound(true))
  }, [params.slug])

  if (notFound) return <div className="p-6 text-slate-400 text-sm text-center">Reviews not available.</div>

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-6 font-sans">
      {/* Aggregate header */}
      <div className="mb-6 pb-5 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-1">{data.title}</h2>
        {data.description && <p className="text-slate-500 text-sm mb-3">{data.description}</p>}
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold text-slate-900">{data.averageRating.toFixed(1)}</span>
          <div>
            <Stars rating={Math.round(data.averageRating)} size="lg" />
            <p className="text-xs text-slate-500 mt-1">{data.totalReviews} review{data.totalReviews !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {data.reviews.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">No reviews yet.</p>
      ) : (
        <div className="space-y-5">
          {data.reviews.map((r) => (
            <div key={r.id} className="border-b border-slate-100 last:border-0 pb-5 last:pb-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{r.reviewerName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(r.createdAt)}</p>
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.body && <p className="text-slate-700 text-sm leading-relaxed">{r.body}</p>}
              {r.reply && (
                <div className="mt-3 pl-3 border-l-2 border-indigo-200 bg-indigo-50 rounded-r-lg py-2 px-3">
                  <p className="text-xs font-semibold text-indigo-700 mb-1">{data.accountName} replied</p>
                  <p className="text-sm text-slate-700">{r.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
