import { describe, it, expect, beforeAll } from 'vitest'
import { signTrackedUrl, verifyTrackedUrl } from '@/lib/link-signing'

// signingKey() reads NEXTAUTH_SECRET at call time, so set it before any test.
beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-for-link-signing'
})

const SEND_ID = 'send-123'
const URL_A = 'https://example.com/landing?utm_source=email'

describe('signTrackedUrl / verifyTrackedUrl', () => {
  it('produces a 16-char hex signature', () => {
    const sig = signTrackedUrl(SEND_ID, URL_A)
    expect(sig).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is deterministic for the same inputs', () => {
    expect(signTrackedUrl(SEND_ID, URL_A)).toBe(signTrackedUrl(SEND_ID, URL_A))
  })

  it('verifies a valid signature', () => {
    const sig = signTrackedUrl(SEND_ID, URL_A)
    expect(verifyTrackedUrl(SEND_ID, URL_A, sig)).toBe(true)
  })

  it('rejects a tampered redirect URL (open-redirect defence)', () => {
    const sig = signTrackedUrl(SEND_ID, URL_A)
    expect(verifyTrackedUrl(SEND_ID, 'https://evil.com', sig)).toBe(false)
  })

  it('rejects a mismatched sendId', () => {
    const sig = signTrackedUrl(SEND_ID, URL_A)
    expect(verifyTrackedUrl('send-999', URL_A, sig)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const sig = signTrackedUrl(SEND_ID, URL_A)
    const tampered = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')
    expect(verifyTrackedUrl(SEND_ID, URL_A, tampered)).toBe(false)
  })

  it('rejects a null signature', () => {
    expect(verifyTrackedUrl(SEND_ID, URL_A, null)).toBe(false)
  })

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifyTrackedUrl(SEND_ID, URL_A, 'short')).toBe(false)
  })

  it('binds the URL to the sendId (swapping either invalidates)', () => {
    const sig = signTrackedUrl(SEND_ID, URL_A)
    const otherUrl = 'https://example.com/other'
    expect(verifyTrackedUrl(SEND_ID, otherUrl, sig)).toBe(false)
  })
})

describe('signingKey requirement', () => {
  it('throws when NEXTAUTH_SECRET is missing, and verify returns false', () => {
    const saved = process.env.NEXTAUTH_SECRET
    delete process.env.NEXTAUTH_SECRET
    try {
      expect(() => signTrackedUrl(SEND_ID, URL_A)).toThrow(/NEXTAUTH_SECRET/)
      // verify swallows the throw and fails closed.
      expect(verifyTrackedUrl(SEND_ID, URL_A, 'deadbeefdeadbeef')).toBe(false)
    } finally {
      process.env.NEXTAUTH_SECRET = saved
    }
  })
})
