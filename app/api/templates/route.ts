import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId ?? null
  if (!accountId) return NextResponse.json([])

  const templates = await prisma.documentTemplate.findMany({
    where: { accountId },
    select: { id: true, type: true, filename: true, updatedAt: true },
    orderBy: { type: 'asc' },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = session.user.accountId ?? null
  if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null

  if (!file || !type || !['quote', 'invoice'].includes(type)) {
    return NextResponse.json({ error: 'file and type (quote|invoice) required' }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith('.docx')) {
    return NextResponse.json({ error: 'Only .docx files are supported' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const template = await prisma.documentTemplate.upsert({
    where: { accountId_type: { accountId, type } },
    create: { accountId, type, filename: file.name, data: buffer },
    update: { filename: file.name, data: buffer },
    select: { id: true, type: true, filename: true, updatedAt: true },
  })

  return NextResponse.json(template)
}
