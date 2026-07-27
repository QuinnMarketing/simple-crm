// Per-account sync into a client's own lead-tracking Google Sheet (e.g. a
// Google Form response sheet feeding a Looker Studio report). Separate from
// lib/google-sheets.ts, which appends every lead across every account into
// one internal master sheet — this targets whichever external sheet an
// account has configured via an AccountIntegration row
// (platform: 'lead_tracking_sheet', config: { spreadsheetId, sheetName }).
import { prisma } from '@/lib/prisma'

const CRM_ID_HEADER = 'CRM Lead ID (Simple CRM sync — do not edit)'
const CRM_ID_COL = 'I'

const LEAD_QUALITY_BY_STATUS: Record<string, number> = {
  won: 5,
  lost: 4,
  qualified: 3,
  contacted: 2,
  new: 2,
  junk: 1,
}

const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

export interface TrackingLead {
  id: string
  email?: string | null
  address?: string | null
  source?: string | null
  status: string
  notes?: string | null
  createdAt: Date
}

interface TrackingSheetConfig {
  spreadsheetId: string
  sheetName: string
}

function leadQualityFromStatus(status: string): number {
  return LEAD_QUALITY_BY_STATUS[status] ?? 2
}

const STREET_SUFFIXES = new Set([
  'st', 'street', 'rd', 'road', 'ave', 'avenue', 'dr', 'drive', 'pl', 'place',
  'cres', 'crescent', 'ct', 'court', 'way', 'pde', 'parade', 'ln', 'lane',
  'hwy', 'highway', 'cl', 'close', 'tce', 'terrace', 'blvd', 'boulevard',
  'gr', 'grove', 'sq', 'square', 'cir', 'circuit', 'esp', 'esplanade',
  'crest', 'rise', 'heights', 'chase', 'walk', 'mews', 'loop', 'run',
])

// Best-effort suburb guess from a free-text address, since Lead has no
// dedicated suburb field. Prefers a comma-delimited segment (e.g.
// "12 Smith St, Craigmore, SA 5114" -> "Craigmore"); when the address is a
// single unbroken line (e.g. "12 Smith St Craigmore SA 5114"), walks
// backwards from the state/end and stops at the first recognised street
// suffix, so "12 Smith St Craigmore" doesn't get returned whole. Returns ''
// when nothing beyond a street can be confidently isolated.
export function parseSuburbFromAddress(address?: string | null): string {
  if (!address) return ''

  const stateMatch = address.match(new RegExp(`\\b(${AU_STATES.join('|')})\\b\\s*\\d{0,4}`, 'i'))
  const before = (stateMatch?.index !== undefined ? address.slice(0, stateMatch.index) : address)
    .trim()
    .replace(/,$/, '')
  if (!before) return ''

  if (before.includes(',')) {
    const segments = before.split(',').map((s) => s.trim()).filter(Boolean)
    if (segments.length > 0) return segments[segments.length - 1]
  }

  const words = before.split(/\s+/).filter(Boolean)
  const tail: string[] = []
  for (let i = words.length - 1; i >= 0 && tail.length < 3; i--) {
    const w = words[i]
    if (!/^[A-Za-z][A-Za-z'-]*$/.test(w) || STREET_SUFFIXES.has(w.toLowerCase())) break
    tail.unshift(w)
  }
  return tail.join(' ')
}

function formatTimestamp(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const hour = get('hour') === '24' ? '0' : get('hour')
  return `${get('month')}/${get('day')}/${get('year')} ${hour}:${get('minute')}:${get('second')}`
}

function leadToRowValues(lead: TrackingLead): string[] {
  return [
    formatTimestamp(lead.createdAt), // A Timestamp
    lead.email || '', // B Email Address
    parseSuburbFromAddress(lead.address), // C Suburb
    '', // D Call Outcome — left for staff to fill in after the call
    lead.source || '', // E Lead Source
    String(leadQualityFromStatus(lead.status)), // F Lead Quality
    lead.notes || '', // G Comments
    '', // H [FRD Response ID] — Forms-internal, not applicable to CRM rows
    lead.id, // I CRM Lead ID (our own dedup key)
  ]
}

async function getAccessToken(): Promise<string | null> {
  const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET
  if (!refreshToken || !clientId || !clientSecret) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = (await res.json()) as Record<string, unknown>
  return (data.access_token as string) || null
}

async function ensureCrmIdColumn(accessToken: string, spreadsheetId: string, sheetName: string) {
  const range = `'${sheetName}'!${CRM_ID_COL}1`
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = (await res.json()) as { values?: string[][] }
  if (data.values?.[0]?.[0] === CRM_ID_HEADER) return

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[CRM_ID_HEADER]] }),
    }
  )
}

async function fetchCrmIdRowMap(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<Map<string, number>> {
  const range = `'${sheetName}'!${CRM_ID_COL}2:${CRM_ID_COL}`
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = (await res.json()) as { values?: string[][] }
  const map = new Map<string, number>()
  ;(data.values || []).forEach((row, i) => {
    const leadId = row[0]
    if (leadId) map.set(leadId, i + 2) // +2: 1-indexed, header is row 1
  })
  return map
}

async function updateRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
) {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  )
}

async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: string[][]
) {
  const range = `'${sheetName}'!A:I`
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    }
  )
  if (!res.ok) throw new Error(`Sheets append failed (${res.status}): ${await res.text()}`)
}

// Appends leads that aren't in the sheet yet (matched by the CRM Lead ID
// column); for leads already present, refreshes Suburb / Lead Source / Lead
// Quality / Comments only — Timestamp, Email Address, Call Outcome and the
// Forms response id are left alone so manual staff edits survive.
export async function syncLeadsToTrackingSheet(
  spreadsheetId: string,
  sheetName: string,
  leads: TrackingLead[]
): Promise<{ appended: number; updated: number }> {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('GOOGLE_SHEETS_REFRESH_TOKEN/CLIENT_ID/CLIENT_SECRET not configured')
  if (leads.length === 0) return { appended: 0, updated: 0 }

  await ensureCrmIdColumn(accessToken, spreadsheetId, sheetName)
  const existing = await fetchCrmIdRowMap(accessToken, spreadsheetId, sheetName)

  const toAppend: string[][] = []
  let updated = 0

  for (const lead of leads) {
    const row = leadToRowValues(lead)
    const rowNumber = existing.get(lead.id)
    if (rowNumber) {
      await updateRange(accessToken, spreadsheetId, `'${sheetName}'!C${rowNumber}`, [[row[2]]])
      await updateRange(accessToken, spreadsheetId, `'${sheetName}'!E${rowNumber}:G${rowNumber}`, [
        [row[4], row[5], row[6]],
      ])
      updated++
    } else {
      toAppend.push(row)
    }
  }

  if (toAppend.length > 0) {
    await appendRows(accessToken, spreadsheetId, sheetName, toAppend)
  }

  return { appended: toAppend.length, updated }
}

async function getTrackingSheetConfig(accountId: string): Promise<TrackingSheetConfig | null> {
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'lead_tracking_sheet' } },
  })
  if (!integration || !integration.enabled) return null
  try {
    const config = JSON.parse(integration.config) as Partial<TrackingSheetConfig>
    if (!config.spreadsheetId || !config.sheetName) return null
    return config as TrackingSheetConfig
  } catch {
    return null
  }
}

// Fire-and-forget single-lead sync — used on lead creation and on status
// change. Appends if the lead isn't in the sheet yet, otherwise updates its
// existing row. Never throws — sheet failures must not affect lead writes.
export async function syncLeadToTrackingSheet(
  accountId: string | null | undefined,
  lead: TrackingLead
): Promise<void> {
  if (!accountId) return
  try {
    const config = await getTrackingSheetConfig(accountId)
    if (!config) return
    await syncLeadsToTrackingSheet(config.spreadsheetId, config.sheetName, [lead])
  } catch (err) {
    console.error('Failed to sync lead to tracking sheet:', err)
  }
}
