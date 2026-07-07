import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Signs the redirect target of a tracked email link so the click endpoint can
 * only be used to redirect to URLs *we* generated. Without this, the click
 * tracker is an open redirect: it legitimately forwards to arbitrary external
 * URLs, so anyone could craft ?u=https://evil.com and abuse the trusted CRM
 * domain for phishing. The signature binds the URL to the sendId.
 *
 * Uses NEXTAUTH_SECRET as the signing key — it's always set server-side and
 * never leaves the server.
 */
function signingKey(): string {
  const key = process.env.NEXTAUTH_SECRET
  if (!key) throw new Error('NEXTAUTH_SECRET is required to sign tracking links')
  return key
}

// Short truncated HMAC — 16 hex chars (64 bits) is ample to stop forgery of a
// non-secret redirect target and keeps the tracking URL compact.
export function signTrackedUrl(sendId: string, url: string): string {
  return createHmac('sha256', signingKey())
    .update(`${sendId}\n${url}`)
    .digest('hex')
    .slice(0, 16)
}

export function verifyTrackedUrl(sendId: string, url: string, sig: string | null): boolean {
  if (!sig) return false
  let expected: string
  try {
    expected = signTrackedUrl(sendId, url)
  } catch {
    return false
  }
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
