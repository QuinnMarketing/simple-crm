'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Zap, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'

function MagicLinkVerifier() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setStatus('error'); return }

    signIn('magic', { token, redirect: false }).then((result) => {
      if (result?.ok) {
        router.push('/')
        router.refresh()
      } else {
        setStatus('error')
      }
    })
  }, [searchParams, router])

  if (status === 'verifying') {
    return (
      <>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-slate-700 font-medium">Signing you in…</p>
      </>
    )
  }

  return (
    <>
      <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
      <p className="text-slate-900 font-semibold mb-1">Link expired or invalid</p>
      <p className="text-slate-500 text-sm mb-6">Magic links expire after 15 minutes and can only be used once.</p>
      <Link
        href="/login"
        className="inline-block bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Back to sign in
      </Link>
    </>
  )
}

export default function MagicLinkPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">Simple CRM</span>
        </div>
        <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />}>
          <MagicLinkVerifier />
        </Suspense>
      </div>
    </div>
  )
}
