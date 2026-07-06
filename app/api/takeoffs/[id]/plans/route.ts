import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: takeoffId } = await params
  const filter = getAccountFilter(session.user)

  const takeoff = await prisma.takeoff.findFirst({ where: { id: takeoffId, ...filter } })
  if (!takeoff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const plans = await prisma.takeoffPlan.findMany({
    where: { takeoffId },
    orderBy: { order: 'asc' },
    select: { id: true, takeoffId: true, name: true, scale: true, measurements: true, order: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json(plans)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: takeoffId } = await params
  const filter = getAccountFilter(session.user)

  const takeoff = await prisma.takeoff.findFirst({ where: { id: takeoffId, ...filter } })
  if (!takeoff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, imageData } = body

  if (!name || !imageData) return NextResponse.json({ error: 'name and imageData required' }, { status: 400 })

  const count = await prisma.takeoffPlan.count({ where: { takeoffId } })

  const plan = await prisma.takeoffPlan.create({
    data: { takeoffId, name, imageData, order: count },
  })

  // Return without imageData in the list (too large) — client already has it
  const { imageData: _omit, ...rest } = plan as typeof plan & { imageData: string }
  return NextResponse.json({ ...rest, imageData }, { status: 201 })
}
