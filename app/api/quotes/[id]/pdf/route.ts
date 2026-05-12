import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { generateInvoicePdf } from '@/lib/pdf-invoice'
// Uses pdfkit — pure Node.js, no native deps, works on Vercel serverless
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const quote = await prisma.quote.findFirst({
    where: { id, ...filter },
    include: {
      lead: { select: { name: true, email: true, phone: true, address: true, service: true, accountId: true } },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const accountId = quote.accountId ?? session.user.accountId ?? quote.lead?.accountId ?? null

  const account = accountId
    ? await prisma.account.findUnique({
        where: { id: accountId },
        select: { name: true, abn: true, businessAddress: true, businessPhone: true, businessEmail: true, businessWebsite: true },
      })
    : null

  try {
    const buffer = await generateInvoicePdf({
      quote,
      lead: quote.lead ?? { name: '', email: null, phone: null, address: null, service: null },
      business: {
        accountName: account?.name ?? '',
        abn: account?.abn,
        businessAddress: account?.businessAddress,
        businessPhone: account?.businessPhone,
        businessEmail: account?.businessEmail,
        businessWebsite: account?.businessWebsite,
      },
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${quote.number}.pdf"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: `PDF generation failed: ${String(err)}` }, { status: 500 })
  }
}
