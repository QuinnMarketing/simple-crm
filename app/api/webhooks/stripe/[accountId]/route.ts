import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getAccountStripe, getAccountStripeConfig } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ accountId: string }> }

// Stripe delivers per-account: the endpoint URL carries the accountId, and we
// verify the signature with that account's own webhook signing secret.
export async function POST(req: NextRequest, { params }: Params) {
  const { accountId } = await params

  const cfg = await getAccountStripeConfig(accountId)
  if (!cfg || !cfg.webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 404 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const stripe = await getAccountStripe(accountId)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, cfg.webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const kind = session.metadata?.kind
    // Only handle sessions we recognise and that belong to this account.
    if (session.metadata?.accountId === accountId) {
      try {
        if (kind === 'invoice') {
          await recordInvoicePayment(session, accountId)
        } else if (kind === 'deposit') {
          await markDepositPaid(session)
        }
      } catch {
        // Return 500 so Stripe retries; the handlers are idempotent so a retry
        // won't double-record.
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}

async function recordInvoicePayment(session: Stripe.Checkout.Session, accountId: string) {
  const quoteId = session.metadata?.quoteId
  if (!quoteId) return

  // Idempotency: never record the same Checkout session twice.
  const existing = await prisma.payment.findFirst({ where: { stripeSessionId: session.id } })
  if (existing) return

  // amount_total is in cents; fall back to amount_subtotal if needed.
  const cents = session.amount_total ?? session.amount_subtotal ?? 0
  const amount = cents / 100
  if (amount <= 0) return

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  await prisma.payment.create({
    data: {
      quoteId,
      accountId,
      amount,
      method: 'stripe',
      paidAt: new Date(),
      notes: 'Paid online via Stripe',
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    },
  })
}

async function markDepositPaid(session: Stripe.Checkout.Session) {
  const appointmentId = session.metadata?.appointmentId
  if (!appointmentId) return

  // Idempotent: updateMany with a not-already-paid guard is a no-op on retry.
  await prisma.appointment.updateMany({
    where: { id: appointmentId, depositPaid: false },
    data: { depositPaid: true },
  })
}
