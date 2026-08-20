import { describe, it, expect } from 'vitest'
import { assessIp, isRfc6598, isPrivate, isIPv6, type IpRow } from '@/lib/click-quality'

// Blocking an IP in Google Ads is invisible to the customer it silences: their
// ads simply stop showing. The asymmetry (a wasted click costs ~$40, a blocked
// suburb costs every lead from it) is why these tests lean on the refusals.

const row = (over: Partial<IpRow> = {}): IpRow => ({
  ip: '203.0.113.10',
  totalVisits: 10,
  botVisits: 10,
  humanVisits: 0,
  distinctUserAgents: 1,
  distinctPaths: 1,
  paidVisits: 10,
  firstSeen: '2026-08-01T00:00:00.000Z',
  lastSeen: '2026-08-20T00:00:00.000Z',
  ...over,
})

describe('CGNAT and address classification', () => {
  it('detects the RFC 6598 carrier-grade NAT block', () => {
    expect(isRfc6598('100.64.0.1')).toBe(true)
    expect(isRfc6598('100.127.255.254')).toBe(true)
    // Boundaries: 100.63.x and 100.128.x are ordinary public space
    expect(isRfc6598('100.63.255.255')).toBe(false)
    expect(isRfc6598('100.128.0.1')).toBe(false)
    expect(isRfc6598('203.0.113.1')).toBe(false)
  })

  it('detects private and IPv6 addresses', () => {
    expect(isPrivate('10.0.0.1')).toBe(true)
    expect(isPrivate('192.168.1.1')).toBe(true)
    expect(isPrivate('172.16.0.1')).toBe(true)
    expect(isPrivate('172.32.0.1')).toBe(false) // just outside the /12
    expect(isPrivate('203.0.113.1')).toBe(false)
    expect(isIPv6('2001:db8::1')).toBe(true)
    expect(isIPv6('203.0.113.1')).toBe(false)
  })
})

describe('assessIp', () => {
  it('allows blocking a consistent single-device offender', () => {
    const a = assessIp(row())
    expect(a.safeToBlock).toBe(true)
    expect(a.sharedRisk).toBe('none')
    expect(a.botRatio).toBe(1)
  })

  it('refuses a carrier-grade NAT address even when every visit is short', () => {
    const a = assessIp(row({ ip: '100.64.12.9' }))
    expect(a.safeToBlock).toBe(false)
    expect(a.sharedRisk).toBe('high')
    expect(a.flags.join(' ')).toMatch(/carrier-grade NAT/i)
  })

  it('refuses an address that many different devices browse from', () => {
    const a = assessIp(row({ distinctUserAgents: 6 }))
    expect(a.safeToBlock).toBe(false)
    expect(a.sharedRisk).toBe('high')
  })

  it('refuses an address that also produces genuinely engaged sessions', () => {
    const a = assessIp(row({ totalVisits: 13, botVisits: 10, humanVisits: 3 }))
    expect(a.safeToBlock).toBe(false)
    expect(a.flags.join(' ')).toMatch(/engaged sessions/i)
  })

  it('waits for enough evidence before allowing a block', () => {
    const a = assessIp(row({ totalVisits: 2, botVisits: 2 }))
    expect(a.safeToBlock).toBe(false)
    expect(a.recommendation).toMatch(/wait for at least/i)
  })

  it('refuses when behaviour is mixed rather than consistently bad', () => {
    const a = assessIp(row({ totalVisits: 10, botVisits: 5, humanVisits: 5 }))
    expect(a.safeToBlock).toBe(false)
    expect(a.botRatio).toBe(0.5)
  })

  it('never treats a private address as blockable', () => {
    const a = assessIp(row({ ip: '192.168.0.5' }))
    expect(a.safeToBlock).toBe(false)
    expect(a.sharedRisk).toBe('high')
  })

  it('flags IPv6 as low-value to block without hard-refusing it', () => {
    const a = assessIp(row({ ip: '2001:db8::1' }))
    expect(a.sharedRisk).toBe('medium')
    expect(a.safeToBlock).toBe(true) // allowed, but the UI surfaces the caveat
    expect(a.flags.join(' ')).toMatch(/rotate/i)
  })
})
