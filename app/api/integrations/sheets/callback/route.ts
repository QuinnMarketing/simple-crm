import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/admin/config?sheets=error&msg=${encodeURIComponent(msg)}`, req.url))

  if (error) return fail(error)
  if (!code) return fail('No authorization code returned')

  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (!clientId || !clientSecret) return fail('Google credentials not configured on server')

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${base}/api/integrations/sheets/callback`,
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
