import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Google Sheets Client ID not configured' }, { status: 500 })

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/integrations/sheets/callback`,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
