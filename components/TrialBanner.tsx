import Link from 'next/link'
import { Clock, AlertTriangle } from 'lucide-react'
import { trialDaysLeft, type TrialAccount } from '@/lib/trial'

/**
 * Slim, non-blocking trial banner. Shown only for accounts on a trial (running
 * or expired). Renders nothing for active/paid accounts or non-trial statuses.
 */
export default function TrialBanner({ account }: { account: TrialAccount }) {
  if (account.subscriptionStatus !== 'trialing') return null

  const daysLeft = trialDaysLeft(account)
  if (daysLeft === null) return null

  if (daysLeft <= 0) {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800 flex items-center justify-center gap-2 text-center">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          Your free trial has ended.{' '}
          <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-red-900">
            Upgrade to keep full access
          </Link>
          .
        </span>
      </div>
    )
  }

  return (
    <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 text-sm text-indigo-800 flex items-center justify-center gap-2 text-center">
      <Clock className="w-4 h-4 shrink-0" />
      <span>
        {daysLeft === 1 ? '1 day' : `${daysLeft} days`} left in your free trial.{' '}
        <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-indigo-900">
          Upgrade anytime
        </Link>
        .
      </span>
    </div>
  )
}
