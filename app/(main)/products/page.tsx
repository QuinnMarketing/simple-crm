'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Trash2, Loader2, Pencil, X, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react'

type FeaturedItem = {
  id: string
  kind: 'product' | 'package'
  name: string
  description: string | null
  priceLabel: string | null
  imageUrl: string | null
  ctaLabel: string | null
  ctaHref: string | null
  sortOrder: number
  active: boolean
}

type FormState = {
  name: string
  description: string
  priceLabel: string
  imageUrl: string
  ctaLabel: string
  ctaHref: string
}

const EMPTY_FORM: FormState = { name: '', description: '', priceLabel: '', imageUrl: '', ctaLabel: '', ctaHref: '' }

function ItemForm({
  initial, kind, onSave, onClose, saving, accountParam,
}: {
  initial: FormState
  kind: 'product' | 'package'
  onSave: (data: FormState) => void
  onClose: () => void
  saving: boolean
  accountParam?: string
}) {
  const [form, setForm] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const uf = new FormData()
      uf.append('file', file)
      const r = await fetch('/api/uploads', { method: 'POST', body: uf })
      const d = await r.json()
      if (r.ok) setForm((f) => ({ ...f, imageUrl: d.url }))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {kind === 'product' ? 'Featured Product' : 'Featured Package'}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <input value={form.name} onChange={set('name')} placeholder="Name *" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={set('description')} placeholder="Short description" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.priceLabel} onChange={set('priceLabel')} placeholder='Price label e.g. "$45" or "From $120"' className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={form.ctaLabel} onChange={set('ctaLabel')} placeholder="Button text (optional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <input value={form.ctaHref} onChange={set('ctaHref')} placeholder="Button link (optional, defaults to /book)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <div>
            <label className="inline-flex items-center gap-2 text-xs text-indigo-600 cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {form.imageUrl ? 'Replace photo' : 'Upload photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="mt-2 w-full h-28 object-cover rounded-lg border border-slate-200" />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function KindSection({
  kind, title, hint, items, accountParam, onChange,
}: {
  kind: 'product' | 'package'
  title: string
  hint: string
  items: FeaturedItem[]
  accountParam?: string
  onChange: () => void
}) {
  const [modal, setModal] = useState<{ open: boolean; item?: FeaturedItem }>({ open: false })
  const [saving, setSaving] = useState(false)

  async function handleSave(form: FormState) {
    setSaving(true)
    try {
      if (modal.item) {
        await fetch(`/api/featured-items/${modal.item.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/featured-items', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, kind, accountParam }),
        })
      }
      setModal({ open: false })
      onChange()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: FeaturedItem) {
    await fetch(`/api/featured-items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !item.active }),
    })
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Delete this item?')) return
    await fetch(`/api/featured-items/${id}`, { method: 'DELETE' })
    onChange()
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button
          onClick={() => setModal({ open: true, item: undefined })}
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">{hint}</p>

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl p-6 text-center">Nothing added yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className={`bg-white border rounded-xl overflow-hidden ${item.active ? 'border-slate-200' : 'border-slate-200 opacity-50'}`}>
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.name} className="w-full h-28 object-cover" />
              )}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm text-slate-900">{item.name}</p>
                  {item.priceLabel && <span className="text-sm text-indigo-600 font-semibold whitespace-nowrap">{item.priceLabel}</span>}
                </div>
                {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
                <div className="flex items-center justify-between mt-3">
                  <button onClick={() => setModal({ open: true, item })} className="p-1 text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(item)} className="p-1 text-slate-400 hover:text-slate-700">
                      {item.active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => remove(item.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <ItemForm
          kind={kind}
          initial={modal.item ? {
            name: modal.item.name, description: modal.item.description ?? '', priceLabel: modal.item.priceLabel ?? '',
            imageUrl: modal.item.imageUrl ?? '', ctaLabel: modal.item.ctaLabel ?? '', ctaHref: modal.item.ctaHref ?? '',
          } : EMPTY_FORM}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
          saving={saving}
          accountParam={accountParam}
        />
      )}
    </div>
  )
}

export default function ProductsPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined
  const [items, setItems] = useState<FeaturedItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (accountParam) qs.set('account', accountParam)
    const r = await fetch(`/api/featured-items?${qs}`)
    if (r.ok) setItems(await r.json())
    setLoading(false)
  }, [accountParam])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Featured Products & Packages</h1>
        <p className="text-sm text-slate-500 mt-1">
          Shown as promo cards on the public website. No online checkout — buttons link to
          booking or contact.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <>
          <KindSection
            kind="product"
            title="Retail Products"
            hint="Take-home products you stock — shown with an 'Ask in-salon' style call to action."
            items={items.filter((i) => i.kind === 'product')}
            accountParam={accountParam}
            onChange={load}
          />
          <KindSection
            kind="package"
            title="Signature Packages"
            hint="Spotlighted treatments or bundles — buttons link straight into booking."
            items={items.filter((i) => i.kind === 'package')}
            accountParam={accountParam}
            onChange={load}
          />
        </>
      )}
    </div>
  )
}
