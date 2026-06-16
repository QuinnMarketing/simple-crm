import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Google Sheets Client ID not configured' }, { status: 500 })

  // Use the request origin to build the redirect URI
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const redirectUri = `${protocol}://${host}/api/integrations/sheets/callback`

  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
