// Shared timezone maths for the booking flow. Availability generation and the
// confirm handler MUST agree on how a local date+time in the account's timezone
// maps to a UTC instant — otherwise stored appointments are offset from the
// slots that were shown, which also breaks double-booking detection.

/** Convert a local YYYY-MM-DD + HH:MM in a named timezone to a UTC Date. */
export function localToUTCDate(dateStr: string, timeStr: string, tz: string): Date {
  return new Date(localToUTCms(dateStr, timeStr, tz))
}

// The timezone's UTC offset (ms) at a given absolute instant.
function offsetAt(instantMs: number, tz: string): number {
  const inTZ = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(instantMs)
  return new Date(inTZ.replace(' ', 'T') + 'Z').getTime() - instantMs
}

/** Convert a local YYYY-MM-DD + HH:MM in a named timezone to a UTC ms timestamp. */
export function localToUTCms(dateStr: string, timeStr: string, tz: string): number {
  // The wall-clock time interpreted as if it were UTC
  const wall = new Date(`${dateStr}T${timeStr}:00Z`).getTime()
  // First guess uses the offset at that (wrong) instant; a second pass
  // recomputes the offset at the candidate instant, which corrects the answer
  // across DST changeovers (the offset can differ between the two instants).
  let utc = wall - offsetAt(wall, tz)
  utc = wall - offsetAt(utc, tz)
  return utc
}
