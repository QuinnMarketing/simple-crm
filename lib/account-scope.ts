type ScopedUser = {
  role?: string | null
  accountId?: string | null
}

export function getAccountFilter(
  user: ScopedUser,
  queryAccountId?: string | null
): Record<string, string | undefined> {
  if (user.role === 'master_admin') {
    if (queryAccountId) return { accountId: queryAccountId }
    return {}
  }
  // Deny access entirely if the user somehow has no accountId
  if (!user.accountId) return { accountId: '__never_match__' }
  return { accountId: user.accountId }
}

export function isMasterAdmin(user: ScopedUser): boolean {
  return user.role === 'master_admin'
}
