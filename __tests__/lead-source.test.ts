import { describe, it, expect } from 'vitest'
import { deriveLeadSource } from '@/lib/lead-source'

describe('deriveLeadSource', () => {
  describe('explicit UTM source', () => {
    it('normalises well-known aliases', () => {
      expect(deriveLeadSource({ utmSource: 'google' })).toBe('Google Ads')
      expect(deriveLeadSource({ utmSource: 'adwords' })).toBe('Google Ads')
      expect(deriveLeadSource({ utmSource: 'fb' })).toBe('Facebook')
      expect(deriveLeadSource({ utmSource: 'meta' })).toBe('Facebook')
      expect(deriveLeadSource({ utmSource: 'ig' })).toBe('Instagram')
      expect(deriveLeadSource({ utmSource: 'newsletter' })).toBe('Email')
    })

    it('is case- and whitespace-insensitive', () => {
      expect(deriveLeadSource({ utmSource: '  Google  ' })).toBe('Google Ads')
      expect(deriveLeadSource({ utmSource: 'FACEBOOK' })).toBe('Facebook')
    })

    it('distinguishes paid Facebook via medium', () => {
      expect(
        deriveLeadSource({ utmSource: 'facebook', utmMedium: 'paid_social' })
      ).toBe('Facebook Ads')
    })

    it('keeps organic Facebook when medium is not paid', () => {
      expect(
        deriveLeadSource({ utmSource: 'facebook', utmMedium: 'social' })
      ).toBe('Facebook')
    })

    it('passes through an unknown utm source verbatim', () => {
      expect(deriveLeadSource({ utmSource: 'partnerXYZ' })).toBe('partnerXYZ')
    })
  })

  describe('ad click IDs (no UTM)', () => {
    it('gclid implies Google Ads', () => {
      expect(deriveLeadSource({ gclid: 'abc123' })).toBe('Google Ads')
    })

    it('fbclid implies Facebook', () => {
      expect(deriveLeadSource({ fbclid: 'xyz789' })).toBe('Facebook')
    })

    it('utm source takes priority over click IDs', () => {
      expect(deriveLeadSource({ utmSource: 'bing', gclid: 'abc' })).toBe(
        'Bing Ads'
      )
    })
  })

  describe('page URL fallback', () => {
    it('detects facebook / instagram / google referrers', () => {
      expect(
        deriveLeadSource({ pageUrl: 'https://www.facebook.com/somepage' })
      ).toBe('Facebook')
      expect(
        deriveLeadSource({ pageUrl: 'https://instagram.com/x' })
      ).toBe('Instagram')
      expect(
        deriveLeadSource({ pageUrl: 'https://www.google.com.au/search' })
      ).toBe('Google')
    })

    it('labels a generic domain as Website (host) with www stripped', () => {
      expect(
        deriveLeadSource({ pageUrl: 'https://www.acme.com.au/contact' })
      ).toBe('Website (acme.com.au)')
    })

    it('returns null for an unparseable page URL', () => {
      expect(deriveLeadSource({ pageUrl: 'not a url' })).toBeNull()
    })
  })

  it('returns null when there is no attribution at all', () => {
    expect(deriveLeadSource({})).toBeNull()
    expect(
      deriveLeadSource({ utmSource: null, gclid: null, fbclid: null, pageUrl: null })
    ).toBeNull()
  })
})
