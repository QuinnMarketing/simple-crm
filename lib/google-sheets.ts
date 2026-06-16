// Google Sheets integration for lead tracking
// Automatically appends new leads to the configured spreadsheet

const SHEET_ID = '1iQMK9pL7Y6mURI11Fg0tpWiHpjmvxzKOP9F9Gf_68-M'
const SHEET_RANGE = 'Sheet1!A:Z'

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

export async function appendLeadToSheet(lead: Lead): Promise<void> {
  try {
    const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN
    if (!refreshToken) {
      console.warn('GOOGLE_SHEETS_REFRESH_TOKEN not set — skipping sheet append')
      return
    }

    const accessToken = await getAccessToken(refreshToken)

    const row = [
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
