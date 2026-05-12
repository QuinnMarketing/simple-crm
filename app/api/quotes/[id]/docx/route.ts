import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { fillTemplate } from '@/lib/docx-template'
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
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
  ])

  if (!template) {
    return NextResponse.json(
      { error: `No ${quote.type} template configured — upload one in Settings.` },
      { status: 404 }
    )
  }

  try {
    const filled = fillTemplate(template.data as Buffer, {
      quote,
      lead: quote.lead ?? { name: '', email: null, phone: null, address: null, service: null },
      accountName: account?.name ?? '',
    })

    return new NextResponse(filled.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${quote.number}.docx"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: `Template rendering failed: ${String(err)}` }, { status: 500 })
  }
}
