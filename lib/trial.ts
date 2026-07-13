/**
 * Trial / subscription state helpers for the self-serve free-trial flow.
 *
 * Trial semantics (platform billing comes later):
 *   - subscriptionStatus === 'active'   → paid, always active
 *   - subscriptionStatus === 'trialing' → active while trialEndsAt is in the future
 *   - anything else                     → inactive
 *
 * Nothing here hard-blocks access yet; the layout only renders a banner.
 */

export type TrialAccount = {
  subscriptionStatus?: string | null
  trialEndsAt?: Date | string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Whole days remaining until the trial ends, rounded up (a trial ending in
 * 25 hours reads as "2 days"). Returns 0 once the trial has ended, and null
 * when the account is not on a trial (e.g. active/paid or no end date set).
 */
export function trialDaysLeft(account: TrialAccount, now: Date = new Date()): number | null {
  if (account.subscriptionStatus !== 'trialing') return null
  const end = toDate(account.trialEndsAt)
  if (!end) return null
  const diff = end.getTime() - now.getTime()
  if (diff <= 0) return 0
  return Math.ceil(diff / DAY_MS)
}

/**
 * Whether the account currently has access. Active for paid ('active') accounts,
 * and for trialing accounts whose trial has not yet expired.
 */
export function isSubscriptionActive(account: TrialAccount, now: Date = new Date()): boolean {
  const status = account.subscriptionStatus ?? 'trialing'
  if (status === 'active') return true
  if (status === 'trialing') {
    const end = toDate(account.trialEndsAt)
    // No end date set → treat as an open trial (still active).
    if (!end) return true
    return end.getTime() > now.getTime()
  }
  return false
}

/** Convenience: is this account on a (still-running) free trial? */
export function isOnTrial(account: TrialAccount, now: Date = new Date()): boolean {
  return account.subscriptionStatus === 'trialing' && isSubscriptionActive(account, now)
}
