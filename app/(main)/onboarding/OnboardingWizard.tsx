'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Building2, CalendarClock, Plug, LayoutDashboard, ArrowRight, CheckCircle2, Rocket } from 'lucide-react'

type Props = {
  accountId: string
  businessName: string
  initial: { businessPhone: string; businessAddress: string; abn: string }
}

export default function OnboardingWizard({ accountId, businessName, initial }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const totalSteps = 2

  const [businessPhone, setBusinessPhone] = useState(initial.businessPhone)
  const [businessAddress, setBusinessAddress] = useState(initial.businessAddress)
  const [abn, setAbn] = useState(initial.abn)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls =
    'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow'

  async function patchAccount(data: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.ok
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const ok = await patchAccount({
      businessPhone: businessPhone.trim(),
      businessAddress: businessAddress.trim(),
      abn: abn.trim(),
    })
    setSaving(false)
    if (!ok) {
      setError('Could not save your details. Please try again.')
      return
    }
    setStep(2)
  }

  async function handleFinish() {
    setError('')
    setSaving(true)
    const ok = await patchAccount({ onboardedAt: new Date().toISOString() })
    setSaving(false)
    if (!ok) {
      setError('Could not finish setup. Please try again.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-indigo-600 mb-2">
          <Rocket className="w-5 h-5" />
          <span className="text-sm font-medium">Welcome to Simple CRM</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Let&apos;s get {businessName} set up</h1>
        <p className="text-slate-500 text-sm mt-1">A couple of quick steps and you&apos;re ready to go.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-indigo-600' : 'bg-slate-200'}`}
          />
        ))}
        <span className="text-xs text-slate-400 ml-2 shrink-0">
          Step {step} of {totalSteps}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        {step === 1 && (
          <form onSubmit={handleDetailsSubmit} className="space-y-5">
            <div className="flex items-center gap-2 text-slate-900">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">Business details</h2>
            </div>
            <p className="text-sm text-slate-500 -mt-3">
              These appear on quotes, invoices and your booking page. You can change them later in Settings.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                autoComplete="tel"
                className={inputCls}
                placeholder="02 1234 5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Business address</label>
              <input
                type="text"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                autoComplete="street-address"
                className={inputCls}
                placeholder="123 Main St, Sydney NSW 2000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ABN</label>
              <input
                type="text"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                inputMode="numeric"
                className={inputCls}
                placeholder="12 345 678 901"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white py-2.5 px-5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-slate-900">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold">You&apos;re all set</h2>
            </div>
            <p className="text-sm text-slate-500 -mt-3">
              Here are a few good places to go next. You can always find these in Settings.
            </p>

            <div className="grid gap-3">
              <NextLink
                href="/settings"
                icon={<CalendarClock className="w-5 h-5 text-indigo-600" />}
                title="Set up online booking"
                desc="Add your services, staff and availability so clients can book you."
              />
              <NextLink
                href="/settings"
                icon={<Plug className="w-5 h-5 text-indigo-600" />}
                title="Connect your integrations"
                desc="Link email, calendar and other tools to keep everything in sync."
              />
              <NextLink
                href="/"
                icon={<LayoutDashboard className="w-5 h-5 text-indigo-600" />}
                title="Explore your dashboard"
                desc="See leads, appointments and activity at a glance."
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="bg-indigo-600 text-white py-2.5 px-5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go to dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NextLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-slate-50 transition-colors group"
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="font-medium text-slate-900 text-sm">{title}</p>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors mt-0.5" />
    </Link>
  )
}
