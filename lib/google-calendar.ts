import { prisma } from './prisma'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API_BASE = 'https://www.googleapis.com/calendar/v3'

interface CalendarConfig {
  refreshToken: string
  email?: string
}

export function getAuthUrl(accountId: string): string {
  const state = Buffer.from(accountId).toString('base64url')
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${params}`
}

export async function exchangeCode(code: string): Promise<{ refreshToken: string; email?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  const data = await res.json()

  let email: string | undefined
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    if (infoRes.ok) email = (await infoRes.json()).email
  } catch { /* best-effort */ }

  return { refreshToken: data.refresh_token, email }
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  return (await res.json()).access_token
}

export async function getCalendarConfig(accountId: string): Promise<CalendarConfig | null> {
  try {
    const row = await prisma.accountIntegration.findUnique({
      where: { accountId_platform: { accountId, platform: 'google_calendar' } },
    })
    if (!row || !row.enabled) return null
    const cfg = JSON.parse(row.config) as Partial<CalendarConfig>
    return cfg.refreshToken ? (cfg as CalendarConfig) : null
  } catch {
    return null
  }
}

export interface GCalEventInput {
  summary: string
  description?: string
  location?: string
  allDay: boolean
  startIso: string // UTC ISO string
  endIso: string   // UTC ISO string
}

function toGCalEvent(e: GCalEventInput) {
  if (e.allDay) {
    const startDate = e.startIso.split('T')[0]
    // GCal all-day end is exclusive — add 1 day
    const endD = new Date(e.endIso)
    endD.setUTCDate(endD.getUTCDate() + 1)
    const endDate = endD.toISOString().split('T')[0]
    return {
      summary: e.summary,
      ...(e.description ? { description: e.description } : {}),
      ...(e.location ? { location: e.location } : {}),
      start: { date: startDate },
      end: { date: endDate },
    }
  }
  return {
    summary: e.summary,
    ...(e.description ? { description: e.description } : {}),
    ...(e.location ? { location: e.location } : {}),
    start: { dateTime: e.startIso, timeZone: 'UTC' },
    end: { dateTime: e.endIso, timeZone: 'UTC' },
  }
}

export async function createCalendarEvent(config: CalendarConfig, event: GCalEventInput): Promise<string> {
  const token = await getAccessToken(config.refreshToken)
  const res = await fetch(`${API_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGCalEvent(event)),
  })
  if (!res.ok) throw new Error(`GCal create failed: ${await res.text()}`)
  return (await res.json()).id as string
}

export async function updateCalendarEvent(config: CalendarConfig, eventId: string, event: GCalEventInput): Promise<void> {
  const token = await getAccessToken(config.refreshToken)
  await fetch(`${API_BASE}/calendars/primary/events/${eventId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGCalEvent(event)),
  })
}

export async function deleteCalendarEvent(config: CalendarConfig, eventId: string): Promise<void> {
  const token = await getAccessToken(config.refreshToken)
  await fetch(`${API_BASE}/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export interface GCalEvent {
  id: string
  summary: string
  start: string
  end: string
  allDay: boolean
  htmlLink?: string
}

export async function listCalendarEvents(config: CalendarConfig, from: string, to: string): Promise<GCalEvent[]> {
  const token = await getAccessToken(config.refreshToken)
  const params = new URLSearchParams({
    timeMin: from,
    timeMax: to,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const res = await fetch(`${API_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`GCal list failed: ${await res.text()}`)
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    summary: item.summary ?? '(No title)',
    start: item.start.dateTime ?? item.start.date,
    end: item.end.dateTime ?? item.end.date,
    allDay: !item.start.dateTime,
    htmlLink: item.htmlLink,
  }))
}
