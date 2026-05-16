'use client'
import { useState } from 'react'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setError('New passwords do not match'); return }
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to update password')
      } else {
        setSuccess(true)
        setCurrent('')
        setNext('')
        setConfirm('')
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Current password</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className={inp + ' pr-10'}
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">New password</label>
        <input
          type={show ? 'text' : 'password'}
          value={next}
          onChange={e => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={inp}
          placeholder="Min. 8 characters"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Confirm new password</label>
        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className={inp}
          placeholder="Repeat new password"
        />
      </div>
      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : success ? <Check className="w-4 h-4" /> : null}
        {saving ? 'Updating…' : success ? 'Updated!' : 'Update password'}
      </button>
    </form>
  )
}
