'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Zap, Loader2, ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Something went wrong')
      else setSent(true)
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

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Check your email</h1>
            <p className="text-slate-500 text-sm mb-6">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Check your inbox and spam folder.
            </p>
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center justify-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Forgot password?</h1>
            <p className="text-slate-500 text-sm mb-6">Enter your email and we&apos;ll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  placeholder="you@example.com"
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
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send reset link'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link href="/login" className="text-slate-500 hover:text-slate-700 text-sm flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
