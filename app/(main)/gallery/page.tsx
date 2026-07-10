'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Trash2, Loader2, ImagePlus, ArrowUp, ArrowDown, ToggleLeft, ToggleRight } from 'lucide-react'

type GalleryImage = {
  id: string
  url: string
  caption: string | null
  sortOrder: number
  active: boolean
}

export default function GalleryPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined

  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (accountParam) qs.set('account', accountParam)
    const r = await fetch(`/api/gallery?${qs}`)
    if (r.ok) setImages(await r.json())
    setLoading(false)
  }, [accountParam])

  useEffect(() => { load() }, [load])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const upRes = await fetch('/api/uploads', { method: 'POST', body: form })
      const upData = await upRes.json()
      if (!upRes.ok) throw new Error(upData.error ?? 'Upload failed')

      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: upData.url, accountParam }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save')
      const created = await res.json()
      setImages((prev) => [...prev, created])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function patch(id: string, data: Partial<GalleryImage>) {
    const r = await fetch(`/api/gallery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (r.ok) {
      const updated = await r.json()
      setImages((prev) => prev.map((i) => (i.id === id ? updated : i)))
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this photo?')) return
    const r = await fetch(`/api/gallery/${id}`, { method: 'DELETE' })
    if (r.ok) setImages((prev) => prev.filter((i) => i.id !== id))
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= images.length) return
    const reordered = [...images]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setImages(reordered)
    reordered.forEach((img, i) => {
      if (img.sortOrder !== i) patch(img.id, { sortOrder: i })
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Website Gallery</h1>
          <p className="text-sm text-slate-500 mt-1">
            Photos shown on the public website&apos;s Gallery page. Drag order with the arrows —
            inactive photos are hidden from the site but kept here.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload Photo'}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl p-10 text-center">
          No photos yet — upload the first one above.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, i) => (
            <div key={img.id} className={`bg-white border rounded-xl overflow-hidden ${img.active ? 'border-slate-200' : 'border-slate-200 opacity-50'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? ''} className="w-full h-36 object-cover" />
              <div className="p-3 space-y-2">
                <input
                  defaultValue={img.caption ?? ''}
                  placeholder="Caption (optional)"
                  onBlur={(e) => { if (e.target.value !== (img.caption ?? '')) patch(img.id, { caption: e.target.value }) }}
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === images.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => patch(img.id, { active: !img.active })} className="p-1 text-slate-400 hover:text-slate-700" title={img.active ? 'Hide from site' : 'Show on site'}>
                      {img.active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => remove(img.id)} className="p-1 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
