type ConnectUser = { role?: string; accountId?: string | null; accountIds?: string[] | null }

// Resolve which account an OAuth "connect" flow should bind to — safely.
//
// master_admin may target any account via ?account=. Everyone else may only
// target an account they actually belong to; a requested account they don't own
// is ignored and their own account is used. This both fixes multi-account users
// (who previously always bound to their primary account, never the one selected)
// and prevents a user from binding a connection onto someone else's account.
export function resolveConnectAccountId(user: ConnectUser, requested: string | null): string {
  const req = requested ?? ''
  if (user.role === 'master_admin') return req || user.accountId || ''
  const owned = new Set<string>([
    ...(user.accountIds ?? []),
    ...(user.accountId ? [user.accountId] : []),
  ])
  if (req && owned.has(req)) return req
  return user.accountId || ''
}
