'use client'
import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, Pencil, Trash2, RefreshCw, ImageIcon, Star, Plus, X, Check } from 'lucide-react'
import TargetCustomerHero, { TargetCustomerPrompt } from '@/components/TargetCustomerHero'

type Avatar = {
  id: string
  name: string
  tagline: string | null
  imageUrl: string | null
  imageOptions: string
  ageRange: string | null
  gender: string | null
  occupation: string | null
  location: string | null
  income: string | null
  goals: string | null
  painPoints: string | null
  objections: string | null
  channels: string | null
  services: string | null
  notes: string | null
  isPrimary: boolean
  source: string
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1'

function parseOptions(raw: string): string[] {
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] }
}

export default function TargetCustomerManager({ accountId }: { accountId: string | null }) {
  const qs = accountId ? `?account=${accountId}` : ''
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Avatar | null>(null)
  const [photoFor, setPhotoFor] = useState<Avatar | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/target-customer${qs}`)
    if (r.ok) setAvatars(await r.json())
    setLoading(false)
  }, [qs])
  useEffect(() => { load() }, [load])

  async function generate(id?: string) {
    setGenerating(true); setError('')
    const r = await fetch(`/api/target-customer/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(accountId ? { accountId } : {}), ...(id ? { id } : {}) }),
    })
    if (r.ok) await load()
    else setError((await r.json().catch(() => ({}))).error ?? 'Generation failed — check your business details and try again.')
    setGenerating(false)
  }

  async function patch(id: string, data: object) {
    setBusyId(id)
    const r = await fetch(`/api/target-customer/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (r.ok) await load()
    setBusyId(null)
  }

  async function del(a: Avatar) {
    if (!confirm(`Delete "${a.name}"?`)) return
    setBusyId(a.id)
    const r = await fetch(`/api/target-customer/${a.id}`, { method: 'DELETE' })
    if (r.ok) setAvatars(prev => prev.filter(x => x.id !== a.id))
    setBusyId(null)
  }

  async function saveEdit() {
    if (!editing) return
    await patch(editing.id, {
      name: editing.name, tagline: editing.tagline, ageRange: editing.ageRange, gender: editing.gender,
      occupation: editing.occupation, location: editing.location, income: editing.income,
      goals: editing.goals, painPoints: editing.painPoints, objections: editing.objections,
      channels: editing.channels, services: editing.services, notes: editing.notes,
    })
    setEditing(null)
  }

  if (loading) {
    return <div className="flex items-center py-16 justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
  }

  const primary = avatars.find(a => a.isPrimary) ?? avatars[0]
  const others = avatars.filter(a => a.id !== primary?.id)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Target Customer</h1>
          <p className="text-slate-500 mt-1 text-sm max-w-xl">The ideal customer you should be chasing — the one who&apos;s easiest to win and best to serve. It greets you on every login so your whole team stays focused on the right buyer.</p>
        </div>
        {avatars.length > 0 && (
          <button onClick={() => generate()} disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add persona with AI
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {avatars.length === 0 ? (
        <div className="space-y-4">
          <TargetCustomerPrompt href="#" />
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => generate()} disabled={generating}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Building your avatar… (~20s)</> : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
            </button>
            <button onClick={async () => { const r = await fetch(`/api/target-customer${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accountId ? { accountId } : {}) }); if (r.ok) { const a = await r.json(); setAvatars([a]); setEditing(a) } }}
              className="flex items-center justify-center gap-2 border border-slate-300 text-slate-600 px-5 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors">
              Create manually
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Primary avatar */}
          {primary && (
            <div>
              <TargetCustomerHero avatar={primary} />
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={() => setEditing(primary)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => generate(primary.id)} disabled={generating} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60">{generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Regenerate</button>
                <button onClick={() => setPhotoFor(primary)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ImageIcon className="w-3.5 h-3.5" /> Change photo</button>
                <button onClick={() => del(primary)} disabled={busyId === primary.id} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </div>
            </div>
          )}

          {/* Other personas */}
          {others.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Other personas</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {others.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      {a.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{a.name}</p>
                      <p className="text-xs text-slate-500 truncate">{a.tagline}</p>
                    </div>
                    <button onClick={() => patch(a.id, { isPrimary: true })} disabled={busyId === a.id} title="Make primary" className="p-1.5 text-slate-400 hover:text-amber-500"><Star className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(a)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del(a)} disabled={busyId === a.id} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-slate-900">Edit persona</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={labelCls}>Name</label><input className={inputCls} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Tagline</label><input className={inputCls} value={editing.tagline ?? ''} onChange={e => setEditing({ ...editing, tagline: e.target.value })} /></div>
              <div><label className={labelCls}>Age range</label><input className={inputCls} value={editing.ageRange ?? ''} onChange={e => setEditing({ ...editing, ageRange: e.target.value })} /></div>
              <div><label className={labelCls}>Gender</label><input className={inputCls} value={editing.gender ?? ''} onChange={e => setEditing({ ...editing, gender: e.target.value })} /></div>
              <div><label className={labelCls}>Occupation / situation</label><input className={inputCls} value={editing.occupation ?? ''} onChange={e => setEditing({ ...editing, occupation: e.target.value })} /></div>
              <div><label className={labelCls}>Location</label><input className={inputCls} value={editing.location ?? ''} onChange={e => setEditing({ ...editing, location: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Income / budget</label><input className={inputCls} value={editing.income ?? ''} onChange={e => setEditing({ ...editing, income: e.target.value })} /></div>
              <div><label className={labelCls}>Goals (one per line)</label><textarea rows={4} className={`${inputCls} resize-none`} value={editing.goals ?? ''} onChange={e => setEditing({ ...editing, goals: e.target.value })} /></div>
              <div><label className={labelCls}>Pain points you solve (one per line)</label><textarea rows={4} className={`${inputCls} resize-none`} value={editing.painPoints ?? ''} onChange={e => setEditing({ ...editing, painPoints: e.target.value })} /></div>
              <div><label className={labelCls}>Objections (one per line)</label><textarea rows={3} className={`${inputCls} resize-none`} value={editing.objections ?? ''} onChange={e => setEditing({ ...editing, objections: e.target.value })} /></div>
              <div><label className={labelCls}>Reach them via (one per line)</label><textarea rows={3} className={`${inputCls} resize-none`} value={editing.channels ?? ''} onChange={e => setEditing({ ...editing, channels: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Services they need (one per line)</label><textarea rows={2} className={`${inputCls} resize-none`} value={editing.services ?? ''} onChange={e => setEditing({ ...editing, services: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={saveEdit} disabled={busyId === editing.id} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{busyId === editing.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo picker */}
      {photoFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPhotoFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Change photo</h2>
              <button onClick={() => setPhotoFor(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {parseOptions(photoFor.imageOptions).length > 0 ? (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {parseOptions(photoFor.imageOptions).map((url, i) => (
                    <button key={i} onClick={async () => { await patch(photoFor.id, { imageUrl: url }); setPhotoFor(null) }}
                      className={`aspect-[4/5] rounded-lg overflow-hidden border-2 ${photoFor.imageUrl === url ? 'border-indigo-500' : 'border-transparent hover:border-slate-300'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 mb-4">No AI photo options — paste an image URL below.</p>}
              <label className={labelCls}>Or paste an image URL</label>
              <div className="flex gap-2">
                <input className={inputCls} placeholder="https://…" defaultValue={photoFor.imageUrl ?? ''} id="avatar-url-input" />
                <button onClick={async () => { const el = document.getElementById('avatar-url-input') as HTMLInputElement; await patch(photoFor.id, { imageUrl: el.value.trim() }); setPhotoFor(null) }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Use</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
