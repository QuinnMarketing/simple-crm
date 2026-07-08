// Shared timezone maths for the booking flow. Availability generation and the
// confirm handler MUST agree on how a local date+time in the account's timezone
// maps to a UTC instant — otherwise stored appointments are offset from the
// slots that were shown, which also breaks double-booking detection.

/** Convert a local YYYY-MM-DD + HH:MM in a named timezone to a UTC Date. */
export function localToUTCDate(dateStr: string, timeStr: string, tz: string): Date {
  return new Date(localToUTCms(dateStr, timeStr, tz))
}

/** Convert a local YYYY-MM-DD + HH:MM in a named timezone to a UTC ms timestamp. */
export function localToUTCms(dateStr: string, timeStr: string, tz: string): number {
  const dtStr = `${dateStr}T${timeStr}:00`
  const asUTCMs = new Date(dtStr + 'Z').getTime()
  const inTZ = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(asUTCMs)
  const tzAsUTCMs = new Date(inTZ.replace(' ', 'T') + 'Z').getTime()
  const offset = tzAsUTCMs - asUTCMs
  return asUTCMs - offset
}
