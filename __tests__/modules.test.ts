import { describe, it, expect } from 'vitest'
import {
  moduleForPath,
  moduleForNavHref,
  DEFAULT_ON_KEYS,
  MODULES,
} from '@/lib/modules'

describe('moduleForPath', () => {
  it('maps an exact route prefix to its module', () => {
    expect(moduleForPath('/api/quotes')).toBe('quotes')
  })

  it('maps a nested route under a prefix to its module', () => {
    expect(moduleForPath('/api/quotes/123/send')).toBe('quotes')
  })

  it('does NOT match a prefix that is only a string prefix of another segment', () => {
    // '/api/quotesXYZ' starts with '/api/quotes' as a string but is a
    // different route — startsWith(prefix + '/') guards against this.
    expect(moduleForPath('/api/quotes-export')).toBeNull()
  })

  it('returns null for core / ungated paths', () => {
    expect(moduleForPath('/api/leads')).toBeNull()
    expect(moduleForPath('/api/settings')).toBeNull()
    expect(moduleForPath('/')).toBeNull()
  })

  it('longest-prefix wins when prefixes overlap', () => {
    // '/api/settings/reviews' is owned by reviews; a shorter '/api/settings'
    // is not owned by any module, so reviews must win for the nested path.
    expect(moduleForPath('/api/settings/reviews')).toBe('reviews')
    expect(moduleForPath('/api/settings/booking')).toBe('calendar')
  })

  it('resolves each module first route prefix to that module', () => {
    for (const m of MODULES) {
      expect(moduleForPath(m.routePrefixes[0])).toBe(m.key)
    }
  })
})

describe('moduleForNavHref', () => {
  it('maps a nav href to its owning module', () => {
    expect(moduleForNavHref('/calendar')).toBe('calendar')
    expect(moduleForNavHref('/price-book')).toBe('quotes')
    expect(moduleForNavHref('/takeoffs')).toBe('takeoffs')
  })

  it('returns null for a core / unknown href', () => {
    expect(moduleForNavHref('/leads')).toBeNull()
    expect(moduleForNavHref('/nope')).toBeNull()
  })

  it('is an exact-match lookup, not a prefix match', () => {
    expect(moduleForNavHref('/calendar/2026')).toBeNull()
  })
})

describe('DEFAULT_ON_KEYS', () => {
  it('is the lean default: only Target Customer and Quotes are on out of the box', () => {
    // Dashboard, Leads and Settings are always-on core (CORE_NAV_HREFS) and are
    // not modules, so the only default-on *modules* are these two.
    expect([...DEFAULT_ON_KEYS].sort()).toEqual(['quotes', 'target_customer'])
  })

  it('leaves every other module off by default', () => {
    for (const key of ['calendar', 'expenses', 'takeoffs', 'reviews', 'gallery', 'products', 'team', 'blog'] as const) {
      expect(DEFAULT_ON_KEYS).not.toContain(key)
    }
  })

  it('contains exactly the modules whose defaultOn is true', () => {
    const expected = MODULES.filter((m) => m.defaultOn).map((m) => m.key)
    expect(DEFAULT_ON_KEYS).toEqual(expected)
  })
})
