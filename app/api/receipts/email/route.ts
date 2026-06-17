import { prisma } from '@/lib/prisma'
import { extractExpenseDataFromImage } from '@/lib/ocr'
import { NextRequest, NextResponse } from 'next/server'

// Unified email receipt handler for Mailgun, Postmark, SendGrid
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const contentType = req.headers.get('content-type') ?? ''

    let accountToken: string | null = null
    let fromEmail: string | null = null
    let attachmentData: { filename: string; data: Buffer; contentType: string } | null = null
    let subject = ''

    // Parse based on email provider
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Mailgun format
      const params = new URLSearchParams(body)
      const recipient = params.get('recipient') ?? ''
      accountToken = extractTokenFromEmail(recipient)
      fromEmail = params.get('sender')
      subject = params.get('subject') ?? ''

      // Handle Mailgun attachments
      const attachmentCount = parseInt(params.get('attachment-count') ?? '0', 10)
      if (attachmentCount > 0) {
        // Mailgun sends attachments separately; we'd need to fetch from their API
        // For now, we'll handle body content only
      }
    } else if (contentType.includes('application/json')) {
      // Postmark or SendGrid JSON format
      const jsonBody = JSON.parse(body) as Record<string, unknown>

      // Postmark format
      if (jsonBody.To) {
        const toEmail = (jsonBody.To as string) || ''
        accountToken = extractTokenFromEmail(toEmail)
        fromEmail = (jsonBody.From as string) || null
        subject = (jsonBody.Subject as string) ?? ''

        if (jsonBody.Attachments && Array.isArray(jsonBody.Attachments)) {
          const att = (jsonBody.Attachments as Array<{ Name?: string; Content?: string; ContentType?: string }>)[0]
          if (att?.Content) {
            attachmentData = {
              filename: att.Name || 'receipt.jpg',
              data: Buffer.from(att.Content, 'base64'),
              contentType: att.ContentType || 'image/jpeg',
            }
          }
        }
      }
      // SendGrid format
      else if (jsonBody.to) {
        const toArray = Array.isArray(jsonBody.to) ? jsonBody.to : [jsonBody.to]
        const toEmail = (toArray[0] as { email?: string } | string)
        const toEmailStr = typeof toEmail === 'string' ? toEmail : toEmail.email
        if (toEmailStr) {
          accountToken = extractTokenFromEmail(toEmailStr)
        }
        const fromObj = jsonBody.from as { email?: string } | undefined
        fromEmail = typeof fromObj === 'object' ? fromObj?.email || null : null
        subject = (jsonBody.subject as string) ?? ''
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Fallback for form-data (Mailgun MIME)
      const boundary = contentType.split('boundary=')[1]
      if (boundary) {
        const parts = body.split(`--${boundary}`)
        for (const part of parts) {
          if (part.includes('Content-Disposition: form-data')) {
            if (part.includes('name="recipient"')) {
              const match = part.match(/\r\n\r\n(.+?)\r\n/)
              if (match) {
                accountToken = extractTokenFromEmail(match[1])
              }
            }
            if (part.includes('name="sender"')) {
              const match = part.match(/\r\n\r\n(.+?)\r\n/)
              if (match) {
                fromEmail = match[1]
              }
            }
            if (part.includes('name="subject"')) {
              const match = part.match(/\r\n\r\n(.+?)\r\n/)
              if (match) {
                subject = match[1]
              }
            }
            if (part.includes('filename=')) {
              const filenameMatch = part.match(/filename="(.+?)"/)
              const contentTypeMatch = part.match(/Content-Type: (.+?)\r\n/)
              if (filenameMatch && contentTypeMatch) {
                const dataMatch = part.match(/\r\n\r\n([\s\S]+)\r\n--/)
                if (dataMatch) {
                  attachmentData = {
                    filename: filenameMatch[1],
                    data: Buffer.from(dataMatch[1], 'binary'),
                    contentType: contentTypeMatch[1],
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!accountToken) {
      return NextResponse.json({ error: 'Invalid receipt email address' }, { status: 400 })
    }

    // Find account by receipt token
    const account = await prisma.account.findFirst({
      where: { receiptEmailToken: accountToken },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Process attachment or extract from subject
    let fileName = 'receipt.jpg'
    let imageUrl: string | null = null
    let ocrData: string | null = null
    let extractedData: { amount?: number; vendor?: string; date?: Date } = {}

    if (attachmentData) {
      fileName = attachmentData.filename

      // Convert to data URL for OCR processing
      const base64 = attachmentData.data.toString('base64')
      imageUrl = `data:${attachmentData.contentType};base64,${base64}`

      // Run OCR on the image
      try {
        const ocrResult = await extractExpenseDataFromImage(imageUrl)
        ocrData = ocrResult.text
        extractedData = {
          amount: ocrResult.amount,
          vendor: ocrResult.vendor,
          date: ocrResult.date,
        }
      } catch (err) {
        console.error('OCR failed for receipt:', err)
        // Continue without OCR data
      }
    }

    // Try to extract data from subject line: "Amount: $50 Vendor: Acme"
    const subjectMatch = subject.match(/\$?([\d.]+)|Vendor:\s*(.+)/i)
    if (subjectMatch && !extractedData.amount) {
      const amount = parseFloat(subjectMatch[1] || '')
      if (!isNaN(amount)) {
        extractedData.amount = amount
      }
    }

    // Create pending receipt
    const pendingReceipt = await prisma.pendingReceipt.create({
      data: {
        accountId: account.id,
        fileName,
        imageUrl: imageUrl || '',
        amount: extractedData.amount ?? null,
        vendor: extractedData.vendor ?? null,
        date: extractedData.date ?? null,
        ocrData: ocrData || null,
        notes: `From: ${fromEmail}, Subject: ${subject}`,
      },
    })

    return NextResponse.json({
      success: true,
      receiptId: pendingReceipt.id,
      extracted: extractedData,
    })
  } catch (err) {
    console.error('Receipt email processing error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process receipt' },
      { status: 500 }
    )
  }
}

function extractTokenFromEmail(email: string): string | null {
  // Extract token from email like: acme-receipts-abc123@domain.com
  const match = email.match(/([a-z0-9-]+)-([a-z0-9]+)@/)
  if (match && match[2]) {
    return match[2]
  }
  return null
}
