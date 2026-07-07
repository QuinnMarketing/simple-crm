import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

function shell(title: string, inner: string) {
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
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 15px; color: #64748b; line-height: 1.6; }
    .badge { display: inline-block; margin-top: 24px; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 600; }
    .actions { margin-top: 28px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    button { border: 0; cursor: pointer; padding: 13px 30px; border-radius: 8px; font-weight: 600; font-size: 15px; font-family: inherit; }
    .accept { background: #16a34a; color: #fff; }
    .reject { background: #fff; color: #dc2626; border: 2px solid #dc2626; }
  </style>
</head>
<body>
  <div class="card">${inner}</div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

function resultPage(title: string, heading: string, message: string, color: string) {
  return shell(title, `
    <div class="icon">${color === '#16a34a' ? '✅' : '❌'}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <div class="badge" style="background:${color}20;color:${color};">${title}</div>`)
}

async function loadQuote(id: string, token: string | null) {
  if (!token) return null
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { account: { select: { name: true } } },
  })
  if (!quote || quote.clientToken !== token) return null
  return quote
}

// GET only *shows* a confirmation — it never changes state. This is deliberate:
// email link scanners and prefetchers (Outlook SafeLinks, antivirus, mail apps)
// issue GET requests, and a state-changing GET would let them silently accept
// or decline a quote. The actual change happens on the POST below.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const action = searchParams.get('action')

  if (!token || (action !== 'accept' && action !== 'reject')) {
    return resultPage('Invalid Link', 'Invalid link', 'This link is missing required parameters. Please contact the business directly.', '#dc2626')
  }

  const quote = await loadQuote(id, token)
  if (!quote) {
    return resultPage('Invalid Link', 'Link not recognised', 'This link is invalid or has expired. Please contact the business directly.', '#dc2626')
  }

  if (quote.status === 'approved' || quote.status === 'declined') {
    const already = quote.status === 'approved' ? 'accepted' : 'declined'
    return resultPage(`Already ${already}`, `Quote already ${already}`, `This quote was already ${already}. No further action is needed.`, quote.status === 'approved' ? '#16a34a' : '#dc2626')
  }

  const businessName = quote.account?.name ?? 'the business'
  const isAccept = action === 'accept'
  const verb = isAccept ? 'accept' : 'decline'

  // Confirmation page: a POST form the customer submits to actually record it
  return shell(
    isAccept ? 'Accept Quote' : 'Decline Quote',
    `
    <div class="icon">${isAccept ? '📝' : '🤔'}</div>
    <h1>${isAccept ? 'Accept this quote?' : 'Decline this quote?'}</h1>
    <p>You're about to <strong>${verb}</strong> ${quote.number} from ${businessName}. Please confirm below.</p>
    <form method="POST" class="actions">
      <input type="hidden" name="token" value="${token}" />
      <input type="hidden" name="action" value="${action}" />
      <button type="submit" class="${isAccept ? 'accept' : 'reject'}">${isAccept ? '✓ Confirm Accept' : '✗ Confirm Decline'}</button>
    </form>`
  )
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  // Accept token/action from either a form post (confirmation page) or query string
  let token: string | null = null
  let action: string | null = null
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    token = form.get('token')?.toString() ?? null
    action = form.get('action')?.toString() ?? null
  }
  const { searchParams } = new URL(req.url)
  token = token ?? searchParams.get('token')
  action = action ?? searchParams.get('action')

  if (!token || (action !== 'accept' && action !== 'reject')) {
    return resultPage('Invalid Link', 'Invalid link', 'This link is missing required parameters. Please contact the business directly.', '#dc2626')
  }

  const quote = await loadQuote(id, token)
  if (!quote) {
    return resultPage('Invalid Link', 'Link not recognised', 'This link is invalid or has expired. Please contact the business directly.', '#dc2626')
  }

  if (quote.status === 'approved' || quote.status === 'declined') {
    const already = quote.status === 'approved' ? 'accepted' : 'declined'
    return resultPage(`Already ${already}`, `Quote already ${already}`, `This quote was already ${already}. No further action is needed.`, quote.status === 'approved' ? '#16a34a' : '#dc2626')
  }

  const newStatus = action === 'accept' ? 'approved' : 'declined'
  await prisma.quote.update({ where: { id }, data: { status: newStatus } })

  const businessName = quote.account?.name ?? 'the business'
  if (action === 'accept') {
    return resultPage('Quote Accepted', 'Quote accepted!', `Thank you! ${businessName} has been notified and will be in touch shortly to confirm the next steps.`, '#16a34a')
  }
  return resultPage('Quote Declined', 'Quote declined', `Your response has been recorded. If you'd like to discuss alternatives, please reach out to ${businessName} directly.`, '#dc2626')
}
