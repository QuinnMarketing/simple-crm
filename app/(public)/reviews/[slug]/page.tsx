'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

type Review = {
  id: string
  reviewerName: string
  rating: number
  body: string | null
  reply: string | null
  repliedAt: string | null
  source: string
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

function ratingLabel(avg: number) {
  if (avg >= 4.8) return 'EXCELLENT'
  if (avg >= 4.0) return 'GREAT'
  if (avg >= 3.0) return 'GOOD'
  if (avg >= 2.0) return 'FAIR'
  return 'POOR'
}

function avatarColor(name: string) {
  const palette = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4']
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}

function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase() || '?'
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {initials}
    </div>
  )
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 40 : 16
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} viewBox="0 0 24 24" width={sz} height={sz}>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={rating >= n ? '#00b67a' : '#e0e0e0'}
          />
        </svg>
      ))}
    </div>
  )
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="flex-shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 12 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GoogleWordmark() {
  return (
    <svg viewBox="0 0 272 92" height="32" aria-label="Google">
      <path d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#EA4335"/>
      <path d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#FBBC05"/>
      <path d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z" fill="#4285F4"/>
      <path d="M225 3v65h-9.5V3h9.5z" fill="#34A853"/>
      <path d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z" fill="#EA4335"/>
      <path d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.92.36 15.95 16.32.5 35.3.5c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.03z" fill="#4285F4"/>
    </svg>
  )
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" className="flex-shrink-0">
      <circle cx="10" cy="10" r="10" fill="#1a1a1a"/>
      <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
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
  const years = Math.floor(months / 12)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

const TRUNCATE = 130

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false)
  const body = review.body ?? ''
  const needsTruncate = body.length > TRUNCATE

  return (
    <div className="relative flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm p-5 h-full select-none" style={{ minHeight: 200 }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={review.reviewerName} />
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-snug truncate">{review.reviewerName}</p>
            <p className="text-gray-400 text-xs mt-0.5">{timeAgo(review.createdAt)}</p>
          </div>
        </div>
        {review.source === 'google' && <GoogleG />}
      </div>

      {/* Stars + verified */}
      <div className="flex items-center gap-1.5 mb-3">
        <StarRow rating={review.rating} />
        <VerifiedBadge />
      </div>

      {/* Body */}
      <div className="flex-1">
        {body ? (
          <>
            <p className="text-gray-600 text-sm leading-relaxed">
              {needsTruncate && !expanded ? body.slice(0, TRUNCATE) + '…' : body}
            </p>
            {needsTruncate && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-gray-400 text-xs mt-1 hover:text-gray-600 font-medium"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </>
        ) : (
          <p className="text-gray-400 text-sm italic">No written review</p>
        )}
      </div>

      {/* Decorative quote mark */}
      <div className="absolute bottom-3 right-4 pointer-events-none opacity-10">
        <svg viewBox="0 0 50 40" width="36" height="28" fill="#9ca3af">
          <path d="M0 40V24C0 10.7 7 3 21 0l4 6.5C18 8.5 14 13 13 20h10v20H0zm27 0V24C27 10.7 34 3 48 0l4 6.5C45 8.5 41 13 40 20h10v20H27z"/>
        </svg>
      </div>
    </div>
  )
}

export default function ReviewsWidget() {
  const params = useParams<{ slug: string }>()
  const [data, setData] = useState<Data | null>(null)
  const [notFound, setNotFound] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    fetch(`/api/review/${params.slug}/list`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); return }
        const d = await r.json()
        setData(d)
        // After data loads, check if carousel needs arrows
        setTimeout(() => checkScroll(), 50)
      })
      .catch(() => setNotFound(true))
  }, [params.slug])

  const checkScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 2)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  function scroll(dir: 1 | -1) {
    const el = trackRef.current
    if (!el) return
    const cardEl = el.firstElementChild as HTMLElement | null
    const cardWidth = cardEl ? cardEl.offsetWidth + 16 : el.clientWidth / 4
    el.scrollBy({ left: dir * cardWidth, behavior: 'smooth' })
  }

  const hasGoogle = data?.reviews.some(r => r.source === 'google') ?? false

  if (notFound) return <div className="p-8 text-gray-400 text-sm text-center font-sans">Reviews not available.</div>

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 bg-white">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="bg-white py-10 font-sans" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Aggregate header */}
      <div className="text-center mb-8 px-4">
        <p className="text-2xl font-black tracking-widest text-gray-900 mb-2 uppercase">
          {ratingLabel(data.averageRating)}
        </p>
        <div className="flex justify-center mb-2">
          <StarRow rating={Math.round(data.averageRating)} size="lg" />
        </div>
        <p className="text-sm text-gray-600">
          Based on <strong>{data.totalReviews} review{data.totalReviews !== 1 ? 's' : ''}</strong>
        </p>
        {hasGoogle && (
          <div className="flex justify-center mt-3">
            <GoogleWordmark />
          </div>
        )}
      </div>

      {/* Carousel */}
      {data.reviews.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No reviews yet.</p>
      ) : (
        <div className="relative px-10">
          {/* Prev */}
          <button
            onClick={() => scroll(-1)}
            disabled={!canPrev}
            aria-label="Previous"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          {/* Track */}
          <div
            ref={trackRef}
            onScroll={checkScroll}
            className="flex gap-4 overflow-x-hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {data.reviews.map(r => (
              <div key={r.id} className="flex-none w-[calc(25%-12px)] min-w-[220px]">
                <ReviewCard review={r} />
              </div>
            ))}
          </div>

          {/* Next */}
          <button
            onClick={() => scroll(1)}
            disabled={!canNext}
            aria-label="Next"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  )
}
