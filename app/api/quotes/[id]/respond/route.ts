import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

function htmlPage(title: string, heading: string, message: string, color: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px 40px; max-width: 420px; width: 100%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 15px; color: #64748b; line-height: 1.6; }
    .badge { display: inline-block; margin-top: 24px; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 600; background: ${color}20; color: ${color}; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${color === '#16a34a' ? '✅' : '❌'}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <div class="badge">${title}</div>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const action = searchParams.get('action')

  if (!token || (action !== 'accept' && action !== 'reject')) {
    return htmlPage('Invalid Link', 'Invalid link', 'This link is missing required parameters. Please contact the business directly.', '#dc2626')
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { account: { select: { name: true } } },
  })

  if (!quote || quote.clientToken !== token) {
    return htmlPage('Invalid Link', 'Link not recognised', 'This link is invalid or has expired. Please contact the business directly.', '#dc2626')
  }

  if (quote.status === 'approved' || quote.status === 'declined') {
    const already = quote.status === 'approved' ? 'accepted' : 'declined'
    return htmlPage(
      `Already ${already}`,
      `Quote already ${already}`,
      `This quote was already ${already}. No further action is needed.`,
      quote.status === 'approved' ? '#16a34a' : '#dc2626'
    )
  }

  const newStatus = action === 'accept' ? 'approved' : 'declined'
  await prisma.quote.update({ where: { id }, data: { status: newStatus } })

  const businessName = quote.account?.name ?? 'the business'

  if (action === 'accept') {
    return htmlPage(
      'Quote Accepted',
      'Quote accepted!',
      `Thank you! ${businessName} has been notified and will be in touch shortly to confirm the next steps.`,
      '#16a34a'
    )
  } else {
    return htmlPage(
      'Quote Declined',
      'Quote declined',
      `Your response has been recorded. If you'd like to discuss alternatives, please reach out to ${businessName} directly.`,
      '#dc2626'
    )
  }
}
