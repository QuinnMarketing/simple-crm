type ScopedUser = {
  role?: string | null
  accountId?: string | null
  accountIds?: string[] | null
}

export function getAccountFilter(
  user: ScopedUser,
  queryAccountId?: string | null
): { accountId?: string | { in: string[] } } {
  if (user.role === 'master_admin') {
    if (queryAccountId) return { accountId: queryAccountId }
    return {}
  }

  // Build the full list of accounts this user belongs to
  const ids = Array.from(new Set([
    ...(user.accountIds ?? []),
    ...(user.accountId ? [user.accountId] : []),
  ]))

  if (ids.length === 0) return { accountId: '__never_match__' }

  // Multi-account users can scope to a specific account via ?account= param
  if (queryAccountId && ids.includes(queryAccountId)) {
    return { accountId: queryAccountId }
  }

  if (ids.length === 1) return { accountId: ids[0] }
  return { accountId: { in: ids } }
}

export function isMasterAdmin(user: ScopedUser): boolean {
  return user.role === 'master_admin'
}

export function isAdmin(user: ScopedUser): boolean {
  return ['master_admin', 'account_admin', 'admin'].includes(user.role ?? '')
}
