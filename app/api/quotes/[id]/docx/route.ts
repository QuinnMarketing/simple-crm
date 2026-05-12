import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { fillTemplate } from '@/lib/docx-template'
import { generateDefaultDocx } from '@/lib/docx-default'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const filter = getAccountFilter(session.user)

  const quote = await prisma.quote.findFirst({
    where: { id, ...filter },
    include: {
      lead: { select: { name: true, email: true, phone: true, address: true, service: true } },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const accountId = quote.accountId ?? session.user.accountId ?? null
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const [template, account] = await Promise.all([
    prisma.documentTemplate.findUnique({ where: { accountId_type: { accountId, type: quote.type } } }),
    prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true, abn: true, businessAddress: true, businessPhone: true, businessEmail: true, businessWebsite: true },
    }),
  ])

  const lead = quote.lead ?? { name: '', email: null, phone: null, address: null, service: null }
  const business = {
    accountName: account?.name ?? '',
    abn: account?.abn,
    businessAddress: account?.businessAddress,
    businessPhone: account?.businessPhone,
    businessEmail: account?.businessEmail,
    businessWebsite: account?.businessWebsite,
  }

  try {
    let buffer: Buffer

    if (template) {
      buffer = fillTemplate(template.data as Buffer, { quote, lead, accountName: business.accountName })
    } else {
      buffer = await generateDefaultDocx(business, quote, lead)
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${quote.number}.docx"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: `Document generation failed: ${String(err)}` }, { status: 500 })
  }
}
