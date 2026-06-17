import { auth } from '@/auth'
import { extractExpenseDataFromImage } from '@/lib/ocr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { imageUrl } = body

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
    }

    // Extract expense data from image using OCR
    const ocrResult = await extractExpenseDataFromImage(imageUrl)

    return NextResponse.json({
      success: true,
      data: {
        text: ocrResult.text,
        amount: ocrResult.amount,
        vendor: ocrResult.vendor,
        date: ocrResult.date?.toISOString(),
        confidence: ocrResult.confidence,
      },
    })
  } catch (err) {
    console.error('OCR error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OCR processing failed' },
      { status: 500 }
    )
  }
}
