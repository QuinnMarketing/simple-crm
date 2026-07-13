import { describe, it, expect } from 'vitest'
import { getAccountFilter, isMasterAdmin, isAdmin } from '@/lib/account-scope'

// This is the tenant-isolation core: getAccountFilter decides which account(s)
// a user is allowed to read. A wrong result here is a cross-tenant data leak or
// an accidental full-table scan, so cover every branch.
describe('getAccountFilter', () => {
  describe('master_admin', () => {
    it('sees everything (empty filter) with no query account', () => {
      expect(getAccountFilter({ role: 'master_admin' })).toEqual({})
    })

    it('scopes to any requested account, even one not in its own list', () => {
      expect(getAccountFilter({ role: 'master_admin' }, 'acct-x')).toEqual({
        accountId: 'acct-x',
      })
    })

    it('ignores an empty-string query account and stays unscoped', () => {
      expect(getAccountFilter({ role: 'master_admin' }, '')).toEqual({})
    })
  })

  describe('single-account user', () => {
    it('scopes to the user accountId', () => {
      expect(getAccountFilter({ accountId: 'acct-1' })).toEqual({
        accountId: 'acct-1',
      })
    })

    it('scopes to a single entry in accountIds', () => {
      expect(getAccountFilter({ accountIds: ['acct-1'] })).toEqual({
        accountId: 'acct-1',
      })
    })

    it('dedupes accountId and accountIds pointing at the same account', () => {
      expect(
        getAccountFilter({ accountId: 'acct-1', accountIds: ['acct-1'] })
      ).toEqual({ accountId: 'acct-1' })
    })

    it('ignores a query account the user does NOT belong to', () => {
      // Critical: a single-account user must not be able to escape to another
      // tenant by passing ?account=other. Falls back to their own account.
      expect(getAccountFilter({ accountId: 'acct-1' }, 'acct-999')).toEqual({
        accountId: 'acct-1',
      })
    })

    it('honours a query account the user DOES belong to', () => {
      expect(getAccountFilter({ accountId: 'acct-1' }, 'acct-1')).toEqual({
        accountId: 'acct-1',
      })
    })
  })

  describe('multi-account user', () => {
    it('produces an { in: [...] } filter across all accounts', () => {
      const result = getAccountFilter({ accountIds: ['acct-1', 'acct-2'] })
      expect(result).toEqual({ accountId: { in: ['acct-1', 'acct-2'] } })
    })

    it('merges accountId into the accountIds list', () => {
      const result = getAccountFilter({
        accountId: 'acct-3',
        accountIds: ['acct-1', 'acct-2'],
      })
      // Set-based union; membership matters, not order.
      expect(result).toHaveProperty('accountId')
      const filter = result.accountId as { in: string[] }
      expect(new Set(filter.in)).toEqual(
        new Set(['acct-1', 'acct-2', 'acct-3'])
      )
    })

    it('narrows to a single account when the query account is one of its own', () => {
      expect(
        getAccountFilter({ accountIds: ['acct-1', 'acct-2'] }, 'acct-2')
      ).toEqual({ accountId: 'acct-2' })
    })

    it('ignores a query account outside its own list and stays multi-scoped', () => {
      const result = getAccountFilter(
        { accountIds: ['acct-1', 'acct-2'] },
        'acct-999'
      )
      expect(result).toEqual({ accountId: { in: ['acct-1', 'acct-2'] } })
    })
  })

  describe('user with no account', () => {
    it('produces a never-match filter (no accounts at all)', () => {
      expect(getAccountFilter({})).toEqual({ accountId: '__never_match__' })
    })

    it('produces a never-match filter for an empty accountIds array', () => {
      expect(
        getAccountFilter({ accountId: null, accountIds: [] })
      ).toEqual({ accountId: '__never_match__' })
    })

    it('never-matches even when a query account is supplied (no privilege escalation)', () => {
      expect(getAccountFilter({}, 'acct-1')).toEqual({
        accountId: '__never_match__',
      })
    })

    it('a non-master role with no account still never-matches', () => {
      expect(getAccountFilter({ role: 'admin' })).toEqual({
        accountId: '__never_match__',
      })
    })
  })
})

describe('isMasterAdmin', () => {
  it('is true only for master_admin', () => {
    expect(isMasterAdmin({ role: 'master_admin' })).toBe(true)
    expect(isMasterAdmin({ role: 'account_admin' })).toBe(false)
    expect(isMasterAdmin({ role: 'admin' })).toBe(false)
    expect(isMasterAdmin({})).toBe(false)
  })
})

describe('isAdmin', () => {
  it('is true for master_admin, account_admin and admin', () => {
    expect(isAdmin({ role: 'master_admin' })).toBe(true)
    expect(isAdmin({ role: 'account_admin' })).toBe(true)
    expect(isAdmin({ role: 'admin' })).toBe(true)
  })

  it('is false for other roles and for no role', () => {
    expect(isAdmin({ role: 'member' })).toBe(false)
    expect(isAdmin({ role: 'user' })).toBe(false)
    expect(isAdmin({})).toBe(false)
  })
})
