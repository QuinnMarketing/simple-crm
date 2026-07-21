'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Trash2, Loader2, Pencil, X, ArrowUp, ArrowDown, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react'

type TeamMember = {
  id: string
  name: string
  role: string | null
  bio: string | null
  photoUrl: string | null
  sortOrder: number
  active: boolean
}

type FormState = { name: string; role: string; bio: string; photoUrl: string }
const EMPTY_FORM: FormState = { name: '', role: '', bio: '', photoUrl: '' }

function MemberForm({
  initial, onSave, onClose, saving,
}: {
  initial: FormState
  onSave: (data: FormState) => void
  onClose: () => void
  saving: boolean
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
      if (r.ok) setForm((f) => ({ ...f, photoUrl: d.url }))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Team Member</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <input value={form.name} onChange={set('name')} placeholder="Name *" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input value={form.role} onChange={set('role')} placeholder="Role e.g. Senior Stylist" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.bio} onChange={set('bio')} placeholder="Short bio (optional)" rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <div>
            <label className="inline-flex items-center gap-2 text-xs text-indigo-600 cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {form.photoUrl ? 'Replace photo' : 'Upload photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
            {form.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photoUrl} alt="" className="mt-2 w-24 h-24 object-cover rounded-full border border-slate-200" />
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

export default function TeamPage() {
  const sp = useSearchParams()
  const accountParam = sp.get('account') ?? undefined
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; item?: TeamMember }>({ open: false })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (accountParam) qs.set('account', accountParam)
    const r = await fetch(`/api/team-members?${qs}`)
    if (r.ok) setMembers(await r.json())
    setLoading(false)
  }, [accountParam])

  useEffect(() => { load() }, [load])

  async function handleSave(form: FormState) {
    setSaving(true)
    try {
      if (modal.item) {
        await fetch(`/api/team-members/${modal.item.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/team-members', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, accountParam }),
        })
      }
      setModal({ open: false })
      load()
    } finally {
      setSaving(false)
    }
  }

  async function patch(id: string, data: Partial<TeamMember>) {
    await fetch(`/api/team-members/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this team member?')) return
    await fetch(`/api/team-members/${id}`, { method: 'DELETE' })
    load()
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= members.length) return
    const reordered = [...members]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setMembers(reordered)
    reordered.forEach((m, i) => { if (m.sortOrder !== i) patch(m.id, { sortOrder: i }) })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-1">Stylist/team bios shown on the public website.</p>
        </div>
        <button
          onClick={() => setModal({ open: true, item: undefined })}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl p-10 text-center">No team members yet.</p>
      ) : (
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={m.id} className={`flex items-center gap-4 bg-white border rounded-xl p-4 ${m.active ? 'border-slate-200' : 'border-slate-200 opacity-50'}`}>
              {m.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photoUrl} alt={m.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-slate-100 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900">{m.name}</p>
                {m.role && <p className="text-xs text-slate-500">{m.role}</p>}
                {m.bio && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{m.bio}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => move(i, 1)} disabled={i === members.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => setModal({ open: true, item: m })} className="p-1 text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => patch(m.id, { active: !m.active })} className="p-1 text-slate-400 hover:text-slate-700">
                  {m.active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => remove(m.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <MemberForm
          initial={modal.item ? { name: modal.item.name, role: modal.item.role ?? '', bio: modal.item.bio ?? '', photoUrl: modal.item.photoUrl ?? '' } : EMPTY_FORM}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
          saving={saving}
        />
      )}
    </div>
  )
}
