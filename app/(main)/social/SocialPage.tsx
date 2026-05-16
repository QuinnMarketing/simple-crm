'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Trash2, Send, Clock, CheckCircle2, XCircle, AlertCircle,
  Facebook, Instagram, Linkedin, Globe, Loader2, X, Image, Link, Calendar,
  ChevronDown, RefreshCw, Sparkles,
} from 'lucide-react'
import { getUpcomingEvents, CATEGORY_META, type UpcomingEvent, type EventCategory, type PostTemplate } from '@/lib/content-calendar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialAccount {
  id: string
  platform: 'facebook' | 'instagram' | 'google_business' | 'linkedin'
  platformId: string
  name: string
  pictureUrl: string | null
  createdAt: string
}

interface PostTarget {
  id: string
  status: 'pending' | 'published' | 'failed'
  error: string | null
  publishedAt: string | null
  socialAccount: { id: string; platform: string; name: string; pictureUrl: string | null }
}

interface SocialPost {
  id: string
  content: string
  mediaUrls: string
  link: string | null
  scheduledAt: string | null
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'partial'
  createdAt: string
  targets: PostTarget[]
}

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_META = {
  facebook: { label: 'Facebook', color: '#1877F2', bgColor: 'bg-blue-600', Icon: Facebook, charLimit: 63206 },
  instagram: { label: 'Instagram', color: '#E1306C', bgColor: 'bg-pink-600', Icon: Instagram, charLimit: 2200 },
  google_business: { label: 'Google Business', color: '#34A853', bgColor: 'bg-green-600', Icon: Globe, charLimit: 1500 },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', bgColor: 'bg-blue-700', Icon: Linkedin, charLimit: 3000 },
  tiktok: { label: 'TikTok', color: '#000000', bgColor: 'bg-black', Icon: null, charLimit: 2200 },
} as const

type Platform = keyof typeof PLATFORM_META

const STATUS_ICON = {
  draft: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  scheduled: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  publishing: <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />,
  published: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  partial: <AlertCircle className="w-3.5 h-3.5 text-amber-500" />,
}

const STATUS_LABEL = {
  draft: 'Draft', scheduled: 'Scheduled', publishing: 'Publishing…',
  published: 'Published', failed: 'Failed', partial: 'Partial',
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
}

function PlatformIcon({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'md' }) {
  const meta = PLATFORM_META[platform as Platform]
  if (!meta) return null
  const sz = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8'
  const iconSz = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const Icon = meta.Icon
  return (
    <span className={`${sz} ${meta.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
      {Icon ? <Icon className={`${iconSz} text-white`} /> : <span className="text-white text-xs font-bold">T</span>}
    </span>
  )
}

// ─── Compose panel ────────────────────────────────────────────────────────────

function toLocalDT(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ComposePanel({
  accounts,
  onPosted,
  accountParam,
  prefill,
}: {
  accounts: SocialAccount[]
  onPosted: (post: SocialPost) => void
  accountParam?: string
  prefill?: { key: number; content: string; scheduledAt?: string }
}) {
  const [content, setContent] = useState(prefill?.content ?? '')
  const [mediaUrl, setMediaUrl] = useState('')
  const [link, setLink] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scheduleMode, setScheduleMode] = useState(!!prefill?.scheduledAt)
  const [scheduledAt, setScheduledAt] = useState(prefill?.scheduledAt ?? '')

  useEffect(() => {
    if (!prefill || prefill.key === 0) return
    setContent(prefill.content)
    setScheduledAt(prefill.scheduledAt ?? '')
    setScheduleMode(!!prefill.scheduledAt)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [prefill?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExtras, setShowExtras] = useState(false)

  const charCount = content.length
  const limit = selected.size === 0 ? 63206
    : Math.min(...Array.from(selected).map(id => {
      const acct = accounts.find(a => a.id === id)
      return acct ? PLATFORM_META[acct.platform]?.charLimit ?? 63206 : 63206
    }))

  function toggleAccount(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function submit(postNow: boolean) {
    if (!content.trim()) { setError('Content is required'); return }
    if (selected.size === 0) { setError('Select at least one account'); return }
    if (!postNow && scheduleMode && !scheduledAt) { setError('Pick a date/time to schedule'); return }
    setSaving(true); setError(null)
    try {
      const qs = accountParam ? `?account=${accountParam}` : ''
      const res = await fetch(`/api/social/posts${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          mediaUrls: mediaUrl ? [mediaUrl] : [],
          link: link || null,
          socialAccountIds: Array.from(selected),
          scheduledAt: !postNow && scheduleMode ? scheduledAt : null,
          postNow,
        }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error ?? 'Error'); return }
      const post = await res.json()
      onPosted(post)
      setContent(''); setMediaUrl(''); setLink(''); setSelected(new Set()); setScheduledAt(''); setScheduleMode(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error') }
    finally { setSaving(false) }
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">No accounts connected</p>
        <p className="text-sm text-slate-400 mt-1">Connect a social account below to start posting</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">New Post</h2>
      </div>
      <div className="p-5 space-y-4">
        {/* Account selector */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Post to</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map(acct => {
              const active = selected.has(acct.id)
              const meta = PLATFORM_META[acct.platform]
              return (
                <button
                  key={acct.id}
                  onClick={() => toggleAccount(acct.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${active ? 'border-transparent text-white' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}
                  style={active ? { backgroundColor: meta?.color ?? '#6366f1' } : {}}
                >
                  {acct.pictureUrl
                    ? <img src={acct.pictureUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                    : <PlatformIcon platform={acct.platform} size="sm" />
                  }
                  <span className="truncate max-w-[120px]">{acct.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={5}
            placeholder="What would you like to share?"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className={`text-xs mt-1 text-right ${charCount > limit ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            {charCount} / {limit.toLocaleString()}
          </p>
        </div>

        {/* Extras toggle */}
        <button onClick={() => setShowExtras(v => !v)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExtras ? 'rotate-180' : ''}`} />
          {showExtras ? 'Hide' : 'Add image or link'}
        </button>

        {showExtras && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div className="relative">
              <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="url"
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder="Image URL (https://...)"
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="Link URL (https://...)"
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Schedule toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScheduleMode(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${scheduleMode ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <Calendar className="w-3.5 h-3.5" /> Schedule
          </button>
          {scheduleMode && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          {scheduleMode ? (
            <button
              onClick={() => submit(false)}
              disabled={saving || charCount > limit}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Schedule Post
            </button>
          ) : (
            <button
              onClick={() => submit(true)}
              disabled={saving || charCount > limit}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Post Now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, onDelete, onPublish }: { post: SocialPost; onDelete: (id: string) => void; onPublish: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const mediaUrls: string[] = JSON.parse(post.mediaUrls || '[]')

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    await fetch(`/api/social/posts/${post.id}`, { method: 'DELETE' })
    onDelete(post.id)
  }

  async function handlePublish() {
    setPublishing(true)
    await fetch(`/api/social/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishNow: true }),
    })
    onPublish(post.id)
    setPublishing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {post.targets.map(t => (
            <div key={t.id} className="flex items-center gap-1.5">
              {t.socialAccount.pictureUrl
                ? <img src={t.socialAccount.pictureUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                : <PlatformIcon platform={t.socialAccount.platform} size="sm" />
              }
              <span className="text-xs text-slate-600">{t.socialAccount.name}</span>
              {t.status === 'failed' && <span title={t.error ?? ''} className="text-red-500"><XCircle className="w-3.5 h-3.5" /></span>}
              {t.status === 'published' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {STATUS_ICON[post.status]}
          <span className="text-xs text-slate-500">{STATUS_LABEL[post.status]}</span>
        </div>
      </div>

      <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">{post.content}</p>

      {mediaUrls[0] && (
        <div className="mt-3 rounded-lg overflow-hidden border border-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrls[0]} alt="Post media" className="w-full max-h-48 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
        </div>
      )}

      {post.link && (
        <a href={post.link} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:underline truncate">
          <Link className="w-3 h-3 flex-shrink-0" />{post.link}
        </a>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
        <p className="text-xs text-slate-400">
          {post.scheduledAt ? `Scheduled: ${fmtDateTime(post.scheduledAt)}` : fmtDateTime(post.createdAt)}
        </p>
        <div className="flex items-center gap-2">
          {post.status === 'scheduled' && (
            <button onClick={handlePublish} disabled={publishing} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
              {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Post now
            </button>
          )}
          {['draft', 'scheduled', 'failed'].includes(post.status) && (
            <button onClick={handleDelete} disabled={deleting} className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Accounts panel ───────────────────────────────────────────────────────────

const CONNECT_PLATFORMS: { platform: Platform | 'tiktok'; label: string; description: string; comingSoon?: boolean }[] = [
  { platform: 'facebook', label: 'Facebook', description: 'Pages you manage' },
  { platform: 'instagram', label: 'Instagram', description: 'Business profiles linked to your Facebook pages' },
  { platform: 'google_business', label: 'Google Business', description: 'Google Business Profile locations' },
  { platform: 'linkedin', label: 'LinkedIn', description: 'Your personal or company page' },
  { platform: 'tiktok', label: 'TikTok', description: 'Video content (coming soon)', comingSoon: true },
]

function AccountsPanel({ accounts, integrations, accountParam, onDisconnect, onLocationsDiscovered }: {
  accounts: SocialAccount[]
  integrations: { platform: string }[]
  accountParam?: string
  onDisconnect: (id: string) => void
  onLocationsDiscovered: () => void
}) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)

  async function handleDisconnect(id: string) {
    if (!confirm('Disconnect this account?')) return
    setDisconnecting(id)
    await fetch(`/api/social/accounts/${id}`, { method: 'DELETE' })
    onDisconnect(id)
    setDisconnecting(null)
  }

  async function handleDiscoverLocations() {
    setDiscovering(true)
    setDiscoverError(null)
    try {
      const res = await fetch('/api/social/discover-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountParam }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDiscoverError(data.error ?? 'Failed to discover locations')
      } else if (data.count === 0) {
        setDiscoverError('No Business Profile locations found — make sure your profile has a verified location.')
      } else {
        onLocationsDiscovered()
      }
    } catch {
      setDiscoverError('Network error — please try again')
    } finally {
      setDiscovering(false)
    }
  }

  function connectUrl(platform: string) {
    const qs = accountParam ? `?account=${accountParam}` : ''
    return `/api/social/connect/${platform}${qs}`
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">Connected Accounts</h2>
        <p className="text-xs text-slate-400 mt-0.5">Connect social accounts to post and schedule content</p>
      </div>

      <div className="divide-y divide-slate-50">
        {CONNECT_PLATFORMS.map(({ platform, label, description, comingSoon }) => {
          const meta = PLATFORM_META[platform as Platform]
          const connected = accounts.filter(a => a.platform === platform)
          const hasIntegration = integrations.some(i => i.platform === platform)
          const Icon = meta?.Icon

          return (
            <div key={platform} className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-9 h-9 ${meta?.bgColor ?? 'bg-slate-200'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    {Icon ? <Icon className="w-4 h-4 text-white" /> : <span className="text-white text-sm font-bold">T</span>}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-xs text-slate-400">{description}</p>
                  </div>
                </div>
                {comingSoon ? (
                  <span className="text-xs text-slate-400 border border-slate-200 rounded-full px-3 py-1">Coming soon</span>
                ) : (
                  <a
                    href={connectUrl(platform)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
                  >
                    <Plus className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                    {(connected.length > 0 || hasIntegration) ? 'Reconnect' : 'Connect'}
                  </a>
                )}
              </div>

              {/* google_business: show "Find Locations" whenever no locations are connected */}
              {platform === 'google_business' && connected.length === 0 && !comingSoon && (
                <div className="mt-3 pl-12">
                  <p className="text-xs text-slate-500 mb-2">After connecting, click below to find your Business Profile locations.</p>
                  {discoverError && (
                    <p className="text-xs text-red-600 mb-2">{discoverError}</p>
                  )}
                  <button
                    onClick={handleDiscoverLocations}
                    disabled={discovering}
                    className="flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
                  >
                    {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Find Locations
                  </button>
                </div>
              )}

              {connected.length > 0 && (
                <div className="mt-3 space-y-2 pl-12">
                  {connected.map(acct => (
                    <div key={acct.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {acct.pictureUrl
                          ? <img src={acct.pictureUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-5 h-5 bg-slate-200 rounded-full flex-shrink-0" />
                        }
                        <span className="text-sm text-slate-700 truncate">{acct.name}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      </div>
                      <button
                        onClick={() => handleDisconnect(acct.id)}
                        disabled={disconnecting === acct.id}
                        className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        {disconnecting === acct.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Content calendar ─────────────────────────────────────────────────────────

function EventCard({
  event,
  expanded,
  onExpand,
  onUse,
}: {
  event: UpcomingEvent
  expanded: boolean
  onExpand: () => void
  onUse: (template: PostTemplate) => void
}) {
  const meta = CATEGORY_META[event.category]
  const fmtDate = event.date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0 leading-none mt-0.5">{event.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-slate-900 text-sm">{event.name}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.textColor} ${meta.bgColor} ${meta.borderColor}`}>
                {meta.label}
              </span>
              {event.daysUntil <= 14 && (
                <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                  {event.daysUntil === 0 ? 'Today!' : event.daysUntil === 1 ? 'Tomorrow!' : `${event.daysUntil} days away`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtDate}
              {event.daysUntil > 14 ? ` · in ${event.daysUntil} days` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => onUse(event.templates[0])}
          className="flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" /> Use Template
        </button>
      </div>

      <div className="mt-3 bg-slate-50 rounded-lg p-3">
        <p className="text-xs text-slate-600 line-clamp-2 whitespace-pre-line">{event.templates[0].content}</p>
      </div>

      {event.templates.length > 1 && (
        <button
          onClick={onExpand}
          className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Hide alternates' : `${event.templates.length - 1} more template${event.templates.length > 2 ? 's' : ''}`}
        </button>
      )}

      {expanded && event.templates.slice(1).map((t, i) => (
        <div key={i} className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">{t.label}</span>
            <button
              onClick={() => onUse(t)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Use this
            </button>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-line">{t.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const CATEGORY_FILTERS: { value: EventCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All events' },
  { value: 'holiday', label: 'Holidays' },
  { value: 'sales', label: 'Sales' },
  { value: 'awareness', label: 'Awareness' },
  { value: 'business', label: 'Business' },
]

function CalendarTab({ onUseTemplate }: {
  onUseTemplate: (content: string, scheduledAt: string) => void
}) {
  const [filter, setFilter] = useState<EventCategory | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const events = useMemo(() => getUpcomingEvents(), [])

  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter)

  const grouped = filtered.reduce<Record<string, UpcomingEvent[]>>((acc, e) => {
    ;(acc[e.monthYear] ??= []).push(e)
    return acc
  }, {})

  function handleUse(event: UpcomingEvent, template: PostTemplate) {
    onUseTemplate(template.content, toLocalDT(event.suggestedScheduleAt))
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-20 text-slate-400">
        <Calendar className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-medium text-slate-500">No upcoming events</p>
        <p className="text-sm mt-1">Try changing the filter above</p>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">Pre-written post templates for key dates</p>
            <p className="text-xs text-indigo-700 mt-0.5">Browse upcoming holidays, sales events, and business milestones. Click "Use Template" to pre-fill the Compose tab — then customise and schedule.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORY_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.value
                ? 'bg-indigo-600 text-white border-transparent'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([monthYear, monthEvents]) => (
        <div key={monthYear} className="mb-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{monthYear}</h3>
          <div className="space-y-3">
            {monthEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                expanded={expandedId === event.id}
                onExpand={() => setExpandedId(expandedId === event.id ? null : event.id)}
                onUse={(t) => handleUse(event, t)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'compose' | 'calendar' | 'scheduled' | 'published' | 'accounts'

export default function SocialPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined
  const socialStatus = sp.get('social')
  const connectedPlatform = sp.get('platform')
  const errorMsg = sp.get('msg')

  const [tab, setTab] = useState<Tab>(
    socialStatus === 'connected' && connectedPlatform === 'google_business' ? 'accounts' : 'compose'
  )
  const [composePrefill, setComposePrefill] = useState<{ key: number; content: string; scheduledAt?: string }>({ key: 0, content: '' })
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [integrations, setIntegrations] = useState<{ platform: string }[]>([])
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/social/accounts${qs}`)
    if (res.ok) {
      const data = await res.json()
      setAccounts(data.accounts ?? [])
      setIntegrations(data.integrations ?? [])
    }
    setLoadingAccounts(false)
  }, [accountParam])

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true)
    const qs = accountParam ? `?account=${accountParam}` : ''
    const res = await fetch(`/api/social/posts${qs}`)
    if (res.ok) setPosts(await res.json())
    setLoadingPosts(false)
  }, [accountParam])

  useEffect(() => { fetchAccounts(); fetchPosts() }, [fetchAccounts, fetchPosts])

  function handlePosted(post: SocialPost) {
    setPosts(prev => [post, ...prev])
    setTab(post.status === 'scheduled' ? 'scheduled' : 'published')
  }

  function handleDelete(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  function handlePublish(id: string) {
    setTimeout(fetchPosts, 1500) // refresh after publish
  }

  function handleDisconnect(id: string) {
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  function handleUseTemplate(content: string, scheduledAt: string) {
    setComposePrefill(prev => ({ key: prev.key + 1, content, scheduledAt }))
    setTab('compose')
  }

  const scheduled = posts.filter(p => p.status === 'scheduled')
  const published = posts.filter(p => ['published', 'partial', 'failed'].includes(p.status))

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'compose', label: 'Compose' },
    { id: 'calendar', label: 'Content Calendar' },
    { id: 'scheduled', label: 'Scheduled', count: scheduled.length || undefined },
    { id: 'published', label: 'Published' },
    { id: 'accounts', label: 'Accounts', count: accounts.length || undefined },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Social Media</h1>
          <p className="text-slate-500 mt-1 text-sm">Post and schedule content across your connected accounts</p>
        </div>
        <button onClick={() => { fetchAccounts(); fetchPosts() }} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {socialStatus === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          {connectedPlatform ? `${PLATFORM_META[connectedPlatform as Platform]?.label ?? connectedPlatform} connected successfully.` : 'Account connected successfully.'}
        </div>
      )}
      {socialStatus === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800">
          <p className="font-medium">
            {connectedPlatform ? `${PLATFORM_META[connectedPlatform as Platform]?.label ?? connectedPlatform} connection failed.` : 'Connection failed.'}
          </p>
          {errorMsg
            ? <p className="mt-1 text-red-700 font-mono text-xs">{decodeURIComponent(errorMsg)}</p>
            : <p className="mt-0.5 text-red-700">Check your app credentials and redirect URIs, then try again.</p>
          }
        </div>
      )}

      {/* Connected accounts quick row */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">Connected:</span>
          {accounts.map(a => (
            <div key={a.id} className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1">
              {a.pictureUrl
                ? <img src={a.pictureUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                : <PlatformIcon platform={a.platform} size="sm" />
              }
              <span className="text-xs text-slate-700 font-medium">{a.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tab === t.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        loadingAccounts ? (
          <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="max-w-2xl">
            <ComposePanel accounts={accounts} onPosted={handlePosted} accountParam={accountParam} prefill={composePrefill} />
          </div>
        )
      )}

      {tab === 'calendar' && (
        <CalendarTab onUseTemplate={handleUseTemplate} />
      )}

      {tab === 'scheduled' && (
        loadingPosts ? (
          <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : scheduled.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-20 text-slate-400">
            <Clock className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium text-slate-500">No scheduled posts</p>
            <p className="text-sm mt-1">Schedule a post from the Compose tab</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduled.map(p => <PostCard key={p.id} post={p} onDelete={handleDelete} onPublish={handlePublish} />)}
          </div>
        )
      )}

      {tab === 'published' && (
        loadingPosts ? (
          <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : published.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center py-20 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium text-slate-500">No published posts yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {published.map(p => <PostCard key={p.id} post={p} onDelete={handleDelete} onPublish={handlePublish} />)}
          </div>
        )
      )}

      {tab === 'accounts' && (
        loadingAccounts ? (
          <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="max-w-2xl">
            <AccountsPanel accounts={accounts} integrations={integrations} accountParam={accountParam} onDisconnect={handleDisconnect} onLocationsDiscovered={fetchAccounts} />
          </div>
        )
      )}
    </div>
  )
}
