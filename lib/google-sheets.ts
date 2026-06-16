// Google Sheets integration for lead tracking
// Automatically appends new leads to the configured spreadsheet

const SHEET_ID = '1iQMK9pL7Y6mURI11Fg0tpWiHpjmvxzKOP9F9Gf_68-M'
const SHEET_RANGE = 'Sheet1!A:Z'

const HEADERS = [
  'Lead ID',
  'Name',
  'Email',
  'Phone',
  'Address',
  'Service',
  'Source',
  'Value',
  'Status',
  'Best Time to Contact',
  'Notes',
  'Created At',
]

interface Lead {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  service?: string | null
  source?: string | null
  value?: number | null
  status?: string
  bestTimeToContact?: string | null
  notes?: string | null
  createdAt: Date
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google Sheets credentials not configured')
  }

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

  const data = await res.json() as Record<string, unknown>
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`)
  }
  return data.access_token as string
}

function leadToRow(lead: Lead): (string | number)[] {
  return [
    lead.id,
    lead.name,
    lead.email || '',
    lead.phone || '',
    lead.address || '',
    lead.service || '',
    lead.source || '',
    lead.value || '',
    lead.status || 'new',
    lead.bestTimeToContact || '',
    lead.notes || '',
    lead.createdAt.toISOString(),
  ]
}

export async function ensureHeadersInSheet(): Promise<void> {
  try {
    const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN
    if (!refreshToken) return

    const accessToken = await getAccessToken(refreshToken)

    // Check if first row has headers
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A1:L1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    const checkData = (await checkRes.json()) as Record<string, unknown>
    const existingRows = checkData.values as unknown[][] | undefined

    // If no data or first row doesn't match headers, add them
    if (!existingRows || existingRows.length === 0 || existingRows[0]?.[0] !== 'Lead ID') {
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [HEADERS],
          }),
        }
      )

      if (!updateRes.ok) {
        console.error('Failed to add headers to sheet:', await updateRes.text())
      }
    }
  } catch (err) {
    console.error('Failed to ensure headers in sheet:', err)
  }
}

export async function appendLeadToSheet(lead: Lead): Promise<void> {
  try {
    const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN
    if (!refreshToken) {
      console.warn('GOOGLE_SHEETS_REFRESH_TOKEN not set — skipping sheet append')
      return
    }

    const accessToken = await getAccessToken(refreshToken)
    const row = leadToRow(lead)

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_RANGE}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    )

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Sheets API error (${res.status}): ${error}`)
    }
  } catch (err) {
    console.error('Failed to append lead to sheet:', err)
    // Don't throw — let lead creation succeed even if sheet write fails
  }
}

export async function backfillLeadsToSheet(leads: Lead[]): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  try {
    const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN
    if (!refreshToken) {
      throw new Error('GOOGLE_SHEETS_REFRESH_TOKEN not set')
    }

    // First ensure headers are present
    await ensureHeadersInSheet()

    const accessToken = await getAccessToken(refreshToken)
    const rows = leads.map(leadToRow)

    // Append all rows at once
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_RANGE}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    )

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Sheets API error (${res.status}): ${error}`)
    }

    success = rows.length
  } catch (err) {
    console.error('Failed to backfill leads to sheet:', err)
    failed = leads.length
  }

  return { success, failed }
}
