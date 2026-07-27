import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const fail = (msg: string) =>
    NextResponse.json({ success: false, error: msg }, { status: 400 })

  if (error) return fail(error)
  if (!code) return fail('No authorization code returned')

  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET

  if (!clientId || !clientSecret) return fail('Google credentials not configured on server')

  // Use the request origin to build the redirect URI (must match the one used in /connect)
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const redirectUri = `${protocol}://${host}/api/integrations/sheets/callback`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const tokenData = await tokenRes.json() as Record<string, unknown>
    if (!tokenRes.ok || tokenData.error) {
      throw new Error(tokenData.error_description as string ?? (tokenData.error as string) ?? 'Token exchange failed')
    }

    const refreshToken = tokenData.refresh_token as string
    if (!refreshToken) {
      throw new Error('No refresh token in response — try revoking existing authorization and reconnecting')
    }

    // Display the refresh token for the user to add to their environment
    return NextResponse.json({
      success: true,
      refreshToken,
      message: 'Authorization successful! Add this to your environment variables:',
      instruction: `GOOGLE_SHEETS_REFRESH_TOKEN=${refreshToken}`,
    })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
