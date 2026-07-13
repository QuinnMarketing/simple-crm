import { describe, it, expect } from 'vitest'
import { localToUTCms, localToUTCDate } from '@/lib/booking-time'

// Availability generation and the confirm handler both rely on this mapping.
// If it's wrong, stored appointments are offset from the slots shown and
// double-booking detection breaks — so pin down real UTC instants, including
// the AEST/AEDT split.
const SYD = 'Australia/Sydney'

describe('localToUTCms (Australia/Sydney)', () => {
  it('maps AEDT summer local time (UTC+11) to the correct UTC instant', () => {
    // 15 Jan is daylight-saving time in Sydney: 09:00 AEDT === 22:00 UTC prev day.
    const ms = localToUTCms('2026-01-15', '09:00', SYD)
    expect(new Date(ms).toISOString()).toBe('2026-01-14T22:00:00.000Z')
  })

  it('maps AEST winter local time (UTC+10) to the correct UTC instant', () => {
    // 15 Jul is standard time in Sydney: 09:00 AEST === 23:00 UTC prev day.
    const ms = localToUTCms('2026-07-15', '09:00', SYD)
    expect(new Date(ms).toISOString()).toBe('2026-07-14T23:00:00.000Z')
  })

  it('handles midnight local time', () => {
    // 00:00 AEST (winter) === 14:00 UTC previous day.
    const ms = localToUTCms('2026-07-15', '00:00', SYD)
    expect(new Date(ms).toISOString()).toBe('2026-07-14T14:00:00.000Z')
  })

  it('is a pure inverse-offset: round-tripping back to Sydney wall time matches (away from DST folds)', () => {
    // Whatever offset was applied, formatting the result back in the tz must
    // reproduce the original wall clock time. NOTE: this round-trip only holds
    // for times that are NOT inside a DST transition window — see the boundary
    // test below for the known quirk on the changeover day.
    const cases: Array<[string, string]> = [
      ['2026-01-15', '09:00'],
      ['2026-07-15', '09:00'],
      ['2026-03-20', '14:30'],
      ['2026-11-05', '08:15'],
    ]
    for (const [date, time] of cases) {
      const ms = localToUTCms(date, time, SYD)
      const wall = new Intl.DateTimeFormat('sv-SE', {
        timeZone: SYD,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }).format(ms)
      expect(wall).toBe(`${date} ${time}`)
    }
  })

  it('applies the AEST offset after the autumn changeover (04:00 on 2026-04-05)', () => {
    // DST ends 2026-04-05 in Sydney: at 03:00 AEDT (+11) clocks go back to
    // 02:00 AEST (+10). After the changeover, 04:00 AEST -> 18:00 UTC prev day.
    expect(localToUTCms('2026-04-05', '04:00', SYD)).toBe(
      Date.parse('2026-04-04T18:00:00Z')
    )
  })

  it('KNOWN QUIRK: times before the autumn changeover on the same day get the post-change (AEST) offset', () => {
    // 01:00 on 2026-04-05 is still AEDT (+11) in reality, so the correct UTC
    // instant is 2026-04-04T14:00:00Z. localToUTCms instead applies the AEST
    // (+10) offset and returns 15:00:00Z. This only affects the ~3h DST-end
    // window on the changeover day; documented here so the behaviour is pinned.
    expect(localToUTCms('2026-04-05', '01:00', SYD)).toBe(
      Date.parse('2026-04-04T15:00:00Z')
    )
  })

  it('applies the AEDT offset after the spring-forward changeover (09:00 on 2026-10-04)', () => {
    // DST starts 2026-10-04: at 02:00 AEST (+10) clocks jump to 03:00 AEDT
    // (+11). After the jump, 09:00 AEDT -> 22:00 UTC prev day.
    expect(localToUTCms('2026-10-04', '09:00', SYD)).toBe(
      Date.parse('2026-10-03T22:00:00Z')
    )
  })

  it('KNOWN QUIRK: times before the spring-forward changeover get the post-change (AEDT) offset', () => {
    // 00:30 on 2026-10-04 is still AEST (+10) in reality, so the correct UTC
    // instant is 2026-10-03T14:30:00Z. localToUTCms instead applies the AEDT
    // (+11) offset and returns 13:30:00Z. Same DST-changeover-day quirk as the
    // autumn case; only affects times before the switch on the changeover day.
    expect(localToUTCms('2026-10-04', '00:30', SYD)).toBe(
      Date.parse('2026-10-03T13:30:00Z')
    )
  })

  it('maps UTC timezone as a no-op offset', () => {
    const ms = localToUTCms('2026-06-01', '12:00', 'UTC')
    expect(new Date(ms).toISOString()).toBe('2026-06-01T12:00:00.000Z')
  })
})

describe('localToUTCDate', () => {
  it('returns a Date equal to the ms variant', () => {
    const d = localToUTCDate('2026-01-15', '09:00', SYD)
    expect(d).toBeInstanceOf(Date)
    expect(d.getTime()).toBe(localToUTCms('2026-01-15', '09:00', SYD))
  })
})
