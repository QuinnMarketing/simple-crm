'use client'
import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

type Templates = { positive: string; neutral: string; negative: string }

type Props = {
  accountId: string
  accountSlug: string
  initial: {
    enabled: boolean
    title: string
    description: string
    autoApprove: boolean
    autoReply: boolean
    replyTemplates: string
  } | null
}

function parseTemplates(raw: string): Templates {
  try {
    const t = JSON.parse(raw)
    return {
      positive: t.positive ?? '',
      neutral: t.neutral ?? '',
      negative: t.negative ?? '',
    }
  } catch {
    return { positive: '', neutral: '', negative: '' }
  }
}

function parseMinRating(raw: string): number {
  try { return JSON.parse(raw).widgetMinRating ?? 0 } catch { return 0 }
}

export default function ReviewSettingsForm({ accountId, accountSlug, initial }: Props) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const reviewUrl = `${baseUrl}/review/${accountSlug}`
  const widgetUrl = `${baseUrl}/reviews/${accountSlug}`
  const embedCode = `<iframe src="${widgetUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`

  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [title, setTitle] = useState(initial?.title ?? 'How was your experience?')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [autoApprove, setAutoApprove] = useState(initial?.autoApprove ?? false)
  const [autoReply, setAutoReply] = useState(initial?.autoReply ?? false)
  const [templates, setTemplates] = useState<Templates>(parseTemplates(initial?.replyTemplates ?? '{}'))
  const [widgetMinRating, setWidgetMinRating] = useState(parseMinRating(initial?.replyTemplates ?? '{}'))

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/settings/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          enabled,
          title,
          description,
          autoApprove,
          autoReply,
          replyTemplates: JSON.stringify({ ...templates, widgetMinRating }),
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Review Widget</h2>
          <p className="text-slate-500 text-sm mt-0.5">Collect and display customer reviews on your website.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-slate-600">{enabled ? 'Enabled' : 'Disabled'}</span>
          <button
            type="button"
            onClick={() => setEnabled((e) => !e)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>
      </div>

      {/* URLs */}
      <div className="space-y-3">
        {[
          { label: 'Review Submission URL', value: reviewUrl, key: 'review', link: true },
          { label: 'Reviews Widget URL', value: widgetUrl, key: 'widget', link: true },
          { label: 'Widget Embed Code', value: embedCode, key: 'embed', link: false },
        ].map(({ label, value, key, link }) => (
          <div key={key}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{label}</p>
            <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <code className="text-xs font-mono text-slate-700 flex-1 break-all">{value}</code>
              <button onClick={() => copyText(value, key)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
                {copied === key ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              {link && (
                <a href={value} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* General */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Page title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Widget display */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Widget Display</p>
        <div>
          <p className="text-sm text-slate-800 mb-1">Minimum star rating to show</p>
          <p className="text-xs text-slate-500 mb-2">Only reviews at or above this rating will appear in the public widget</p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setWidgetMinRating(n)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  widgetMinRating === n
                    ? 'bg-amber-400 border-amber-400 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {n === 0 ? 'All' : `${n}★+`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Automation */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Automation</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
          />
          <div>
            <p className="text-sm text-slate-800">Auto-approve reviews</p>
            <p className="text-xs text-slate-500">New reviews go straight to approved and show on the widget</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoReply}
            onChange={(e) => setAutoReply(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
          />
          <div>
            <p className="text-sm text-slate-800">Auto-reply by email</p>
            <p className="text-xs text-slate-500">Send a templated reply when a reviewer provides their email</p>
          </div>
        </label>
      </div>

      {/* Reply templates */}
      {autoReply && (
        <div className="space-y-3 pl-4 border-l-2 border-indigo-100">
          <p className="text-sm font-medium text-slate-700">Auto-reply templates</p>
          {[
            { key: 'positive', label: '4–5 stars (Positive)', placeholder: 'Thank you so much for the kind words! We really appreciate your feedback…' },
            { key: 'neutral', label: '3 stars (Neutral)', placeholder: 'Thank you for your feedback. We\'d love to know how we can improve…' },
            { key: 'negative', label: '1–2 stars (Negative)', placeholder: 'We\'re sorry to hear about your experience. Please reach out so we can make this right…' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <textarea
                value={templates[key as keyof Templates]}
                onChange={(e) => setTemplates((t) => ({ ...t, [key]: e.target.value }))}
                rows={3}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
        <button
          onClick={save}
          disabled={saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Review Settings'}
        </button>
      </div>
    </div>
  )
}
