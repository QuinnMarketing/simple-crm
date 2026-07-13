import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { getAccountStripe } from '@/lib/stripe'
import { getBaseUrl } from '@/lib/base-url'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)
  const quote = await prisma.quote.findFirst({
    where: { id, ...filter },
    include: { payments: true, lead: true, account: { select: { name: true } } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.type !== 'invoice') return NextResponse.json({ error: 'Only invoices can be paid online' }, { status: 400 })
  if (!quote.accountId) return NextResponse.json({ error: 'Invoice is not linked to an account' }, { status: 400 })

  // Outstanding balance = total minus everything already recorded against it.
  const paid = quote.payments.reduce((s, p) => s + p.amount, 0)
  const balance = Math.round((quote.total - paid) * 100) / 100
  if (balance <= 0) return NextResponse.json({ error: 'This invoice is already paid in full' }, { status: 400 })

  let stripe
  try {
    stripe = await getAccountStripe(quote.accountId)
  } catch {
    return NextResponse.json({ error: 'Stripe is not configured for this account. Add your keys in Settings → Payments.' }, { status: 400 })
  }

  const base = getBaseUrl()
  const businessName = quote.account?.name ?? 'Invoice'

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'aud',
            unit_amount: Math.round(balance * 100), // cents
            product_data: { name: `${businessName} — Invoice ${quote.number}` },
          },
        },
      ],
      customer_email: quote.lead?.email ?? undefined,
      metadata: { kind: 'invoice', quoteId: quote.id, accountId: quote.accountId },
      success_url: `${base}/pay/result?status=success&invoice=${encodeURIComponent(quote.number)}`,
      cancel_url: `${base}/pay/result?status=cancelled&invoice=${encodeURIComponent(quote.number)}`,
    })

    if (!checkout.url) return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 })
    return NextResponse.json({ url: checkout.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment could not be started'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
