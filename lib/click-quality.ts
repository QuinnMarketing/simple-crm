// Paid-click quality scoring.
//
// The premise: a session that lasts under ~2s on a landing page almost never
// represents a real enquiry, so an IP that does it repeatedly on paid clicks is
// a candidate for a Google Ads IP exclusion.
//
// The danger: carrier-grade NAT. A single mobile IP can front thousands of
// genuine customers, so blocking one can quietly cost real leads. Everything
// below exists to separate "one bad actor" from "a shared egress point".

/** Sessions at or under this are treated as non-genuine. */
export const BOT_THRESHOLD_MS = 2000

/**
 * RFC 6598 shared address space (100.64.0.0/10) is reserved specifically for
 * carrier-grade NAT, so a hit here is definitive rather than heuristic.
 */
export function isRfc6598(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\./)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  return a === 100 && b >= 64 && b <= 127
}

/** RFC 1918 / loopback / link-local — never worth blocking, usually our own probes. */
export function isPrivate(ip: string): boolean {
  return (
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^127\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === '::1'
  )
}

/**
 * IPv6 addresses are handed out per-device far more often than shared, but
 * mobile networks still rotate them per session, which inflates unique-IP
 * counts and makes blocking individual addresses close to useless.
 */
export function isIPv6(ip: string): boolean {
  return ip.includes(':')
}

export type IpRow = {
  ip: string
  totalVisits: number
  botVisits: number          // sessions <= BOT_THRESHOLD_MS
  humanVisits: number        // sessions > BOT_THRESHOLD_MS
  distinctUserAgents: number
  distinctPaths: number
  paidVisits: number         // visits carrying a gclid
  firstSeen: string
  lastSeen: string
}

export type SharedRisk = 'none' | 'low' | 'medium' | 'high'

export type IpAssessment = {
  botRatio: number
  sharedRisk: SharedRisk
  /** Human-readable reasons the IP may be shared — shown next to the block button. */
  flags: string[]
  /** False when blocking is likely to hit real customers. */
  safeToBlock: boolean
  recommendation: string
}

/**
 * Judges whether an IP is safe to exclude. Deliberately conservative: the cost
 * of blocking a shared carrier IP (silently losing real calls) is far higher
 * than the cost of tolerating a few wasted clicks.
 */
export function assessIp(row: IpRow, opts: { minVisitsToBlock?: number } = {}): IpAssessment {
  const minVisits = opts.minVisitsToBlock ?? 3
  const botRatio = row.totalVisits > 0 ? row.botVisits / row.totalVisits : 0
  const flags: string[] = []
  // Tracked as a number so the running maximum is not narrowed away by TS.
  const LEVELS: SharedRisk[] = ['none', 'low', 'medium', 'high']
  let riskLevel = 0
  const bump = (r: SharedRisk) => {
    riskLevel = Math.max(riskLevel, LEVELS.indexOf(r))
  }

  if (isPrivate(row.ip)) {
    flags.push('Private/internal address — not a real visitor')
    bump('high')
  }
  if (isRfc6598(row.ip)) {
    flags.push('RFC 6598 carrier-grade NAT range (100.64.0.0/10) — shared by many subscribers')
    bump('high')
  }
  if (isIPv6(row.ip)) {
    flags.push('IPv6 — mobile networks rotate these per session, so blocking one achieves little')
    bump('medium')
  }
  // A genuine bot/competitor is one browser. Many distinct user agents behind a
  // single address is the classic signature of a NAT gateway or office egress.
  if (row.distinctUserAgents >= 5) {
    flags.push(`${row.distinctUserAgents} different browsers/devices — likely a shared connection`)
    bump('high')
  } else if (row.distinctUserAgents >= 3) {
    flags.push(`${row.distinctUserAgents} different browsers/devices seen`)
    bump('medium')
  }
  // Mixed behaviour is the strongest counter-signal: if real people also browse
  // properly from this address, it is not a pure bot source.
  if (row.humanVisits >= 3) {
    flags.push(`${row.humanVisits} genuine engaged sessions also came from here`)
    bump('high')
  } else if (row.humanVisits > 0) {
    flags.push(`${row.humanVisits} engaged session(s) also from this IP`)
    bump('low')
  }

  const sharedRisk = LEVELS[riskLevel]
  const enoughEvidence = row.botVisits >= minVisits
  const safeToBlock =
    enoughEvidence && botRatio >= 0.8 && riskLevel < 3 && !isPrivate(row.ip)

  let recommendation: string
  if (!enoughEvidence) {
    recommendation = `Only ${row.botVisits} short session(s) — wait for at least ${minVisits} before blocking.`
  } else if (riskLevel === 3) {
    recommendation = 'Do not block — strong signs this address is shared by real users.'
  } else if (botRatio < 0.8) {
    recommendation = `Only ${Math.round(botRatio * 100)}% of visits are short — mixed behaviour, hold off.`
  } else if (riskLevel === 2) {
    recommendation = 'Probably safe, but review the flags first.'
  } else {
    recommendation = `${row.botVisits} of ${row.totalVisits} visits under ${BOT_THRESHOLD_MS / 1000}s — safe to block.`
  }

  return { botRatio, sharedRisk, flags, safeToBlock, recommendation }
}
