import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const body = await req.json()
  const { quotePrefix, invoicePrefix, nextQuoteNum, nextInvoiceNum, numberPadding } = body

  const data: Record<string, unknown> = {}
  if (quotePrefix !== undefined) data.quotePrefix = String(quotePrefix).slice(0, 20)
  if (invoicePrefix !== undefined) data.invoicePrefix = String(invoicePrefix).slice(0, 20)
  if (nextQuoteNum !== undefined) {
    const n = parseInt(nextQuoteNum)
    if (!isNaN(n) && n >= 1) data.nextQuoteNum = n
  }
  if (nextInvoiceNum !== undefined) {
    const n = parseInt(nextInvoiceNum)
    if (!isNaN(n) && n >= 1) data.nextInvoiceNum = n
  }
  if (numberPadding !== undefined) {
    const n = parseInt(numberPadding)
    if (!isNaN(n) && n >= 1 && n <= 6) data.numberPadding = n
  }

  const settings = await prisma.documentSettings.upsert({
    where: { accountId },
    create: { accountId, ...data },
    update: data,
  })

  return NextResponse.json(settings)
}
