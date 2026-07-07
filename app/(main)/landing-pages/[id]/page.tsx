'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Trash2, ExternalLink, Globe, Copy, Check, Plus, X, Eye, Users, Phone, FileText, Rocket, AlertTriangle } from 'lucide-react'
import { parseContent, type LandingPageContent } from '@/lib/landing-page-types'

type PageData = {
  id: string
  name: string
  slug: string
  status: string
  goal: string
  content: string
  views: number
  leads: number
  businessPhone: string | null
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
      {hint && <p className="text-xs text-slate-400 mt-0.5 mb-3">{hint}</p>}
      <div className={`space-y-3 ${hint ? '' : 'mt-3'}`}>{children}</div>
    </div>
  )
}

export default function LandingPageEditor() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sp = useSearchParams()
  const accountParam = sp.get('account')

  const [page, setPage] = useState<PageData | null>(null)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('form')
  const [slug, setSlug] = useState('')
  const [content, setContent] = useState<LandingPageContent | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/landing-pages/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: PageData | null) => {
        if (data) {
          setPage(data)
          setName(data.name)
          setGoal(data.goal)
          setSlug(data.slug)
          setContent(parseContent(data.content))
        }
      })
  }, [id])

  const update = useCallback((patch: Partial<LandingPageContent>) => {
    setContent(c => c ? { ...c, ...patch } : c)
    setDirty(true)
  }, [])

  async function save(extra?: { status?: string }) {
    if (!content) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/landing-pages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content, goal, slug, ...extra }),
    })
    if (res.ok) {
      const data = await res.json()
      setPage(p => p ? { ...p, status: data.status, name: data.name, slug: data.slug, goal: data.goal } : p)
      setSlug(data.slug)
      setDirty(false)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Save failed')
    }
    setSaving(false)
    setPublishing(false)
  }

  async function togglePublish() {
    if (!page) return
    setPublishing(true)
    await save({ status: page.status === 'published' ? 'draft' : 'published' })
  }

  async function handleDelete() {
    if (!page || !confirm(`Delete "${page.name}"? The page URL will stop working immediately.`)) return
    setDeleting(true)
    const res = await fetch(`/api/landing-pages/${id}`, { method: 'DELETE' })
    if (res.ok) router.push(`/landing-pages${accountParam ? `?account=${accountParam}` : ''}`)
    else setDeleting(false)
  }

  function copyUrl() {
    if (!page) return
    navigator.clipboard.writeText(`${window.location.origin}/lp/${page.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!page || !content) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  const c = content
  const isPublished = page.status === 'published'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href={`/landing-pages${accountParam ? `?account=${accountParam}` : ''}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Landing Pages
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setDirty(true) }}
              className="text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none w-full max-w-lg"
            />
            <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {page.status}
              </span>
              <button onClick={copyUrl} className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                /lp/{page.slug}
              </button>
              <span className="flex items-center gap-1 text-slate-400"><Eye className="w-3.5 h-3.5" />{page.views} views</span>
              <span className="flex items-center gap-1 text-slate-400"><Users className="w-3.5 h-3.5" />{page.leads} leads</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/lp/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Preview
            </a>
            <button
              onClick={() => save()}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {saving && !publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={togglePublish}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 ${isPublished ? 'bg-slate-500 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Page settings" hint="Goal drives which calls to action are shown">
            <div>
              <label className={labelCls}>Page goal</label>
              <div className="flex gap-2">
                {([
                  { value: 'form', label: 'Form leads', Icon: FileText },
                  { value: 'call', label: 'Phone calls', Icon: Phone },
                  { value: 'both', label: 'Both', Icon: Rocket },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setGoal(value); setDirty(true) }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      goal === value ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
              {goal !== 'form' && !page.businessPhone && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  No business phone is set on this account, so call buttons won&apos;t appear — add one under Settings → Business details.
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Page URL</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-400 flex-shrink-0">/lp/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setDirty(true) }}
                  className={inputCls}
                  placeholder="my-page-url"
                />
              </div>
              {slug !== page.slug && (
                <p className="mt-1.5 text-xs text-slate-400">Changing the URL breaks any ads or emails already pointing at /lp/{page.slug}</p>
              )}
            </div>
          </Section>

          <Section title="Hero" hint="The first thing visitors see — headline sells the outcome">
            <div>
              <label className={labelCls}>Trust badge</label>
              <input type="text" value={c.hero.badge} onChange={e => update({ hero: { ...c.hero, badge: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Headline</label>
              <input type="text" value={c.hero.headline} onChange={e => update({ hero: { ...c.hero, headline: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Subheadline</label>
              <textarea rows={2} value={c.hero.subheadline} onChange={e => update({ hero: { ...c.hero, subheadline: e.target.value } })} className={`${inputCls} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Button text</label>
                <input type="text" value={c.hero.ctaLabel} onChange={e => update({ hero: { ...c.hero, ctaLabel: e.target.value } })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Accent colour</label>
                <input type="color" value={c.theme.primaryColor} onChange={e => update({ theme: { primaryColor: e.target.value } })} className="h-9 w-full rounded-lg border border-slate-300 cursor-pointer" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Background photo</label>
              {c.hero.backgroundImage ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.hero.backgroundImage} alt="Hero background" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                  <div className="flex gap-2">
                    {c.hero.imageOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const opts = c.hero.imageOptions
                          const next = opts[(opts.indexOf(c.hero.backgroundImage) + 1) % opts.length]
                          update({ hero: { ...c.hero, backgroundImage: next } })
                        }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Try next photo ({c.hero.imageOptions.indexOf(c.hero.backgroundImage) + 1}/{c.hero.imageOptions.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => update({ hero: { ...c.hero, backgroundImage: '' } })}
                      className="text-xs font-medium text-slate-400 hover:text-red-500"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              ) : c.hero.imageOptions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => update({ hero: { ...c.hero, backgroundImage: c.hero.imageOptions[0] } })}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Add background photo
                </button>
              ) : (
                <p className="text-xs text-slate-400">Plain dark background — photos are found automatically when a page is generated</p>
              )}
            </div>
          </Section>

          <Section title="Benefits">
            <div>
              <label className={labelCls}>Section title</label>
              <input type="text" value={c.benefits.title} onChange={e => update({ benefits: { ...c.benefits, title: e.target.value } })} className={inputCls} />
            </div>
            {c.benefits.items.map((item, i) => (
              <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-2 relative">
                <button
                  onClick={() => update({ benefits: { ...c.benefits, items: c.benefits.items.filter((_, x) => x !== i) } })}
                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                ><X className="w-3.5 h-3.5" /></button>
                <input type="text" value={item.title} placeholder="Benefit title" onChange={e => update({ benefits: { ...c.benefits, items: c.benefits.items.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x) } })} className={inputCls} />
                <textarea rows={2} value={item.description} placeholder="Description" onChange={e => update({ benefits: { ...c.benefits, items: c.benefits.items.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x) } })} className={`${inputCls} resize-none`} />
              </div>
            ))}
            <button onClick={() => update({ benefits: { ...c.benefits, items: [...c.benefits.items, { title: '', description: '' }] } })} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              <Plus className="w-3.5 h-3.5" /> Add benefit
            </button>
          </Section>

          <Section title="Offer">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={c.offer.enabled} onChange={e => update({ offer: { ...c.offer, enabled: e.target.checked } })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Show offer banner
            </label>
            {c.offer.enabled && (
              <>
                <input type="text" value={c.offer.title} placeholder="Offer title" onChange={e => update({ offer: { ...c.offer, title: e.target.value } })} className={inputCls} />
                <textarea rows={2} value={c.offer.description} placeholder="Offer description" onChange={e => update({ offer: { ...c.offer, description: e.target.value } })} className={`${inputCls} resize-none`} />
                <input type="text" value={c.offer.urgency} placeholder="Urgency line (optional, keep honest)" onChange={e => update({ offer: { ...c.offer, urgency: e.target.value } })} className={inputCls} />
              </>
            )}
          </Section>

          <Section title="Reviews" hint="Pulled from your approved customer reviews — edit or remove as needed">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={c.reviews.enabled} onChange={e => update({ reviews: { ...c.reviews, enabled: e.target.checked } })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Show reviews section
            </label>
            {c.reviews.enabled && (
              <>
                {c.reviews.items.map((r, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-2 relative">
                    <button
                      onClick={() => update({ reviews: { ...c.reviews, items: c.reviews.items.filter((_, x) => x !== i) } })}
                      className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                    ><X className="w-3.5 h-3.5" /></button>
                    <div className="flex gap-2 pr-6">
                      <input
                        type="text"
                        value={r.name}
                        placeholder="Customer name"
                        onChange={e => update({ reviews: { ...c.reviews, items: c.reviews.items.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x) } })}
                        className={`${inputCls} flex-1`}
                      />
                      <select
                        value={r.rating}
                        onChange={e => update({ reviews: { ...c.reviews, items: c.reviews.items.map((x, xi) => xi === i ? { ...x, rating: parseInt(e.target.value) } : x) } })}
                        className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {[5, 4, 3].map(n => <option key={n} value={n}>{n}★</option>)}
                      </select>
                    </div>
                    <textarea rows={2} value={r.text} placeholder="What they said" onChange={e => update({ reviews: { ...c.reviews, items: c.reviews.items.map((x, xi) => xi === i ? { ...x, text: e.target.value } : x) } })} className={`${inputCls} resize-none`} />
                  </div>
                ))}
                <button
                  onClick={() => update({ reviews: { ...c.reviews, items: [...c.reviews.items, { name: '', rating: 5, text: '' }] } })}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Add review
                </button>
              </>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="FAQ">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={c.faq.enabled} onChange={e => update({ faq: { ...c.faq, enabled: e.target.checked } })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Show FAQ section
            </label>
            {c.faq.enabled && (
              <>
                {c.faq.items.map((f, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-2 relative">
                    <button
                      onClick={() => update({ faq: { ...c.faq, items: c.faq.items.filter((_, x) => x !== i) } })}
                      className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                    ><X className="w-3.5 h-3.5" /></button>
                    <input type="text" value={f.question} placeholder="Question" onChange={e => update({ faq: { ...c.faq, items: c.faq.items.map((x, xi) => xi === i ? { ...x, question: e.target.value } : x) } })} className={inputCls} />
                    <textarea rows={2} value={f.answer} placeholder="Answer" onChange={e => update({ faq: { ...c.faq, items: c.faq.items.map((x, xi) => xi === i ? { ...x, answer: e.target.value } : x) } })} className={`${inputCls} resize-none`} />
                  </div>
                ))}
                <button onClick={() => update({ faq: { ...c.faq, items: [...c.faq.items, { question: '', answer: '' }] } })} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  <Plus className="w-3.5 h-3.5" /> Add question
                </button>
              </>
            )}
          </Section>

          <Section title="Final call to action">
            <div>
              <label className={labelCls}>Headline</label>
              <input type="text" value={c.finalCta.headline} onChange={e => update({ finalCta: { ...c.finalCta, headline: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Button text</label>
              <input type="text" value={c.finalCta.ctaLabel} onChange={e => update({ finalCta: { ...c.finalCta, ctaLabel: e.target.value } })} className={inputCls} />
            </div>
            {(c.finalCta.backgroundImage || c.hero.imageOptions.length > 0) && (
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!c.finalCta.backgroundImage}
                  onChange={e => update({
                    finalCta: {
                      ...c.finalCta,
                      backgroundImage: e.target.checked
                        ? (c.hero.imageOptions[1] ?? c.hero.imageOptions[0] ?? '')
                        : '',
                    },
                  })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Show background photo behind this section
              </label>
            )}
          </Section>

          <Section title="Lead form">
            <div>
              <label className={labelCls}>Form title</label>
              <input type="text" value={c.form.title} onChange={e => update({ form: { ...c.form, title: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Submit button</label>
              <input type="text" value={c.form.buttonLabel} onChange={e => update({ form: { ...c.form, buttonLabel: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fields <span className="text-slate-400 normal-case font-normal">(fewer fields = more leads)</span></label>
              <div className="flex gap-2 flex-wrap">
                {['name', 'phone', 'email', 'address', 'message'].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => update({
                      form: {
                        ...c.form,
                        fields: c.form.fields.includes(f) ? c.form.fields.filter(x => x !== f) : [...c.form.fields, f],
                      },
                    })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                      c.form.fields.includes(f) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Thank you message" hint="Shown after the form is submitted">
            <input type="text" value={c.thankYou.headline} onChange={e => update({ thankYou: { ...c.thankYou, headline: e.target.value } })} className={inputCls} />
            <textarea rows={2} value={c.thankYou.message} onChange={e => update({ thankYou: { ...c.thankYou, message: e.target.value } })} className={`${inputCls} resize-none`} />
          </Section>

          <Section title="SEO / ad preview">
            <div>
              <label className={labelCls}>Page title</label>
              <input type="text" value={c.meta.title} onChange={e => update({ meta: { ...c.meta, title: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Meta description</label>
              <textarea rows={2} value={c.meta.description} onChange={e => update({ meta: { ...c.meta, description: e.target.value } })} className={`${inputCls} resize-none`} />
            </div>
          </Section>

          <div className="flex justify-end">
            <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium disabled:opacity-50">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
