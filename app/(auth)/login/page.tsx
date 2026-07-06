'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Loader2, Mail, CheckCircle } from 'lucide-react'

export default function LoginPage() {
  const [tab, setTab] = useState<'password' | 'magic'>('magic')

  // Password form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Magic link form
  const [magicEmail, setMagicEmail] = useState('')
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [magicError, setMagicError] = useState('')

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  async function handleMagicSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMagicLoading(true)
    setMagicError('')
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail }),
      })
      if (res.ok) {
        setMagicSent(true)
      } else {
        setMagicError('Something went wrong. Please try again.')
      }
    } catch {
      setMagicError('Network error — please try again.')
    } finally {
      setMagicLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow'

  return (
    <div className="w-full max-w-md px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">Simple CRM</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h1>
        <p className="text-slate-500 text-sm mb-6">Access your CRM</p>

        {/* Tab toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => setTab('password')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setTab('magic')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'magic' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Email link
          </button>
        </div>

        {tab === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700">Forgot password?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                className={inputCls}
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
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        ) : magicSent ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-900 mb-1">Check your email</p>
            <p className="text-slate-500 text-sm">We sent a sign-in link to <strong>{magicEmail}</strong>. It expires in 15 minutes.</p>
            <button
              type="button"
              onClick={() => { setMagicSent(false); setMagicEmail('') }}
              className="mt-5 text-sm text-indigo-600 hover:text-indigo-700"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                required
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            {magicError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{magicError}</p>
            )}
            <button
              type="submit"
              disabled={magicLoading}
              className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {magicLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send sign-in link</>}
            </button>
            <p className="text-xs text-slate-400 text-center">We'll email you a link — no password needed.</p>
          </form>
        )}
      </div>
    </div>
  )
}
