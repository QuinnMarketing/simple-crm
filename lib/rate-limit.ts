/**
 * Simple in-memory sliding-window rate limiter. Per serverless instance, so
 * it's a soft limit under horizontal scaling — still enough to stop casual
 * brute force and email bombing. Swap for Upstash Ratelimit if hard global
 * limits are ever needed.
 */
const hits = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart)
  if (timestamps.length >= limit) {
    hits.set(key, timestamps)
    return false
  }
  timestamps.push(now)
  hits.set(key, timestamps)
  // Opportunistic cleanup to keep the map bounded
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k)
    }
  }
  return true
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
}
