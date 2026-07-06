import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; planId: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: takeoffId, planId } = await params
  const filter = getAccountFilter(session.user)

  const takeoff = await prisma.takeoff.findFirst({ where: { id: takeoffId, ...filter } })
  if (!takeoff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const plan = await prisma.takeoffPlan.findFirst({ where: { id: planId, takeoffId } })
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(plan)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; planId: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: takeoffId, planId } = await params
  const filter = getAccountFilter(session.user)

  const takeoff = await prisma.takeoff.findFirst({ where: { id: takeoffId, ...filter } })
  if (!takeoff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.takeoffPlan.findFirst({ where: { id: planId, takeoffId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.scale !== undefined) data.scale = body.scale
  if (body.measurements !== undefined) data.measurements = body.measurements

  const plan = await prisma.takeoffPlan.update({ where: { id: planId }, data })
  const { imageData: _omit, ...rest } = plan as typeof plan & { imageData: string }
  return NextResponse.json(rest)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; planId: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: takeoffId, planId } = await params
  const filter = getAccountFilter(session.user)

  const takeoff = await prisma.takeoff.findFirst({ where: { id: takeoffId, ...filter } })
  if (!takeoff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.takeoffPlan.findFirst({ where: { id: planId, takeoffId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.takeoffPlan.delete({ where: { id: planId } })
  return NextResponse.json({ ok: true })
}
