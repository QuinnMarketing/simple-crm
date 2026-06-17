// OCR functionality for expense receipts using Google Cloud Vision API

interface OcrResult {
  text: string
  amount?: number
  vendor?: string
  date?: Date
  confidence: number
}

async function getGoogleVisionAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_VISION_REFRESH_TOKEN || process.env.GOOGLE_SHEETS_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Vision credentials not configured')
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
    throw new Error('Failed to get Google Vision access token')
  }
  return data.access_token as string
}

function extractAmountFromText(text: string): number | undefined {
  // Look for currency patterns: $123.45, 123.45 AUD, etc.
  const patterns = [
    /\$\s*(\d+(?:[.,]\d{2})?)/,
    /(?:AUD|USD|EUR)\s*(\d+(?:[.,]\d{2})?)/i,
    /(\d+(?:[.,]\d{2}))\s*(?:AUD|USD|EUR)/i,
    /Total[:\s]+\$?\s*(\d+(?:[.,]\d{2})?)/i,
    /Amount[:\s]+\$?\s*(\d+(?:[.,]\d{2})?)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const amountStr = match[1].replace(',', '.')
      const amount = parseFloat(amountStr)
      if (!isNaN(amount)) return amount
    }
  }
  return undefined
}

function extractVendorFromText(text: string): string | undefined {
  // Look for common vendor indicators
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip short lines and common non-vendor words
    if (
      trimmed.length > 3 &&
      trimmed.length < 100 &&
      !trimmed.match(/^\d+/) &&
      !trimmed.match(/total|amount|paid|price|cost|qty|quantity/i)
    ) {
      return trimmed
    }
  }
  return undefined
}

function extractDateFromText(text: string): Date | undefined {
  // Look for date patterns: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const patterns = [
    /(\d{1,2})[-/.(\s](\d{1,2})[-/.]\s*(\d{4})/,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      let day, month, year
      if (pattern === patterns[0]) {
        day = parseInt(match[1], 10)
        month = parseInt(match[2], 10)
        year = parseInt(match[3], 10)
      } else {
        year = parseInt(match[1], 10)
        month = parseInt(match[2], 10)
        day = parseInt(match[3], 10)
      }

      if (month > 0 && month <= 12 && day > 0 && day <= 31) {
        const date = new Date(year, month - 1, day)
        if (date.getFullYear() === year) {
          return date
        }
      }
    }
  }
  return undefined
}

export async function extractExpenseDataFromImage(imageUrl: string): Promise<OcrResult> {
  try {
    const accessToken = await getGoogleVisionAccessToken()

    // Fetch the image and convert to base64
    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image: ${imageRes.statusText}`)
    }

    const buffer = await imageRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // Call Google Vision API
    const visionRes = await fetch(
      'https://vision.googleapis.com/v1/images:annotate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            },
          ],
        }),
      }
    )

    const visionData = await visionRes.json() as Record<string, unknown>

    if (!visionRes.ok) {
      throw new Error(`Vision API error: ${JSON.stringify(visionData)}`)
    }

    const responses = (visionData.responses as Array<{ fullTextAnnotation?: { text?: string } }>) || []
    const firstResponse = responses[0]
    const fullText = firstResponse?.fullTextAnnotation?.text ?? ''

    if (!fullText) {
      throw new Error('No text detected in image')
    }

    // Extract structured data from OCR text
    const amount = extractAmountFromText(fullText)
    const vendor = extractVendorFromText(fullText)
    const date = extractDateFromText(fullText)

    return {
      text: fullText,
      amount,
      vendor,
      date,
      confidence: 0.8, // Default confidence for OCR extraction
    }
  } catch (err) {
    console.error('OCR extraction error:', err)
    throw err
  }
}
