'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    try {
      const { token } = await params
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Something went wrong')
      else {
        setDone(true)
        setTimeout(() => router.push('/login'), 2500)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">Simple CRM</span>
        </div>

        {done ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Password updated</h1>
            <p className="text-slate-500 text-sm">Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h1>
            <p className="text-slate-500 text-sm mb-6">Choose a strong password — at least 8 characters.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                    placeholder="Min. 8 characters"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  placeholder="Repeat password"
                />
              </div>
              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : 'Update password'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link href="/login" className="text-slate-500 hover:text-slate-700 text-sm">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
