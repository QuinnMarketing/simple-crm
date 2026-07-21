'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Trash2, Loader2, Pencil, X, ImagePlus, Eye, EyeOff } from 'lucide-react'

type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string
  coverImageUrl: string | null
  category: string | null
  publishedAt: string | null
}

type FormState = { title: string; slug: string; excerpt: string; body: string; coverImageUrl: string; category: string }
const EMPTY_FORM: FormState = { title: '', slug: '', excerpt: '', body: '', coverImageUrl: '', category: '' }

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

function PostForm({
  initial, onSave, onClose, saving,
}: {
  initial: FormState
  onSave: (data: FormState) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [slugTouched, setSlugTouched] = useState(!!initial.slug)
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: val }
      if (k === 'title' && !slugTouched) next.slug = slugify(val)
      return next
    })
    if (k === 'slug') setSlugTouched(true)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const uf = new FormData()
      uf.append('file', file)
      const r = await fetch('/api/uploads', { method: 'POST', body: uf })
      const d = await r.json()
      if (r.ok) setForm((f) => ({ ...f, coverImageUrl: d.url }))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Blog Post</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <input value={form.title} onChange={set('title')} placeholder="Title *" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex-shrink-0">/blog/</span>
            <input value={form.slug} onChange={set('slug')} placeholder="url-slug" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <input value={form.category} onChange={set('category')} placeholder="Category e.g. Hair Care (optional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.excerpt} onChange={set('excerpt')} placeholder="Short excerpt for the blog list (optional)" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.body} onChange={set('body')} placeholder="Body (markdown) *" rows={14} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
          <div>
            <label className="inline-flex items-center gap-2 text-xs text-indigo-600 cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {form.coverImageUrl ? 'Replace cover image' : 'Upload cover image'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
            {form.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImageUrl} alt="" className="mt-2 w-full h-32 object-cover rounded-lg border border-slate-200" />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim() || !form.body.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BlogPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; item?: BlogPost }>({ open: false })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (accountParam) qs.set('account', accountParam)
    const r = await fetch(`/api/blog-posts?${qs}`)
    if (r.ok) setPosts(await r.json())
    setLoading(false)
  }, [accountParam])

  useEffect(() => { load() }, [load])

  async function handleSave(form: FormState) {
    setSaving(true)
    try {
      if (modal.item) {
        const r = await fetch(`/api/blog-posts/${modal.item.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title, excerpt: form.excerpt, body: form.body, coverImageUrl: form.coverImageUrl, category: form.category }),
        })
        if (!r.ok) { alert((await r.json()).error ?? 'Save failed'); return }
      } else {
        const r = await fetch('/api/blog-posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, accountParam }),
        })
        if (!r.ok) { alert((await r.json()).error ?? 'Save failed'); return }
      }
      setModal({ open: false })
      load()
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish(post: BlogPost) {
    await fetch(`/api/blog-posts/${post.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishedAt: post.publishedAt ? null : new Date().toISOString() }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/blog-posts/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Blog</h1>
          <p className="text-sm text-slate-500 mt-1">Educational content shown on the public website&apos;s Blog page.</p>
        </div>
        <button
          onClick={() => setModal({ open: true, item: undefined })}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
        >
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl p-10 text-center">No posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4">
              {p.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-slate-900 truncate">{p.title}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.publishedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {p.publishedAt ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">/blog/{p.slug}</p>
                {p.excerpt && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{p.excerpt}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setModal({ open: true, item: p })} className="p-1.5 text-slate-400 hover:text-slate-700"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => togglePublish(p)} className="p-1.5 text-slate-400 hover:text-slate-700" title={p.publishedAt ? 'Unpublish' : 'Publish'}>
                  {p.publishedAt ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => remove(p.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <PostForm
          initial={modal.item ? {
            title: modal.item.title, slug: modal.item.slug, excerpt: modal.item.excerpt ?? '',
            body: modal.item.body, coverImageUrl: modal.item.coverImageUrl ?? '', category: modal.item.category ?? '',
          } : EMPTY_FORM}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
          saving={saving}
        />
      )}
    </div>
  )
}
