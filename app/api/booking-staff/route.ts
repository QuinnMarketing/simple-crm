import { auth } from '@/auth'
import { requireModule } from '@/lib/account-modules'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

function resolveAccountId(user: { role?: string; accountId?: string | null }, req: NextRequest): string | null {
  if (user.role === 'master_admin') return req.nextUrl.searchParams.get('account') ?? user.accountId ?? null
  return user.accountId ?? null
}

// Lists every account user alongside their booking-staff profile (bookable,
// working hours, assigned services). Users without a profile appear as
// not-yet-bookable defaults.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const accountId = resolveAccountId(session.user, req)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  const [users, profiles] = await Promise.all([
    prisma.user.findMany({ where: { accountId }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } }),
    prisma.bookingStaffProfile.findMany({ where: { accountId }, include: { services: { select: { id: true } } } }),
  ])
  const byUser = new Map(profiles.map((p) => [p.userId, p]))

  return NextResponse.json({
    staff: users.map((u) => {
      const p = byUser.get(u.id)
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        bookable: p?.bookable ?? false,
        availableHours: p?.availableHours ?? '{}',
        serviceIds: p?.services.map((s) => s.id) ?? [],
      }
    }),
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await requireModule(session.user, 'calendar'); if (gate) return gate

  const accountId = resolveAccountId(session.user, req)
  if (!accountId) return NextResponse.json({ error: 'No account selected' }, { status: 400 })

  const body = await req.json()
  const userId = String(body.userId ?? '')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Validate the user and services belong to this account
  const user = await prisma.user.findFirst({ where: { id: userId, accountId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not in this account' }, { status: 400 })

  const requestedIds: string[] = Array.isArray(body.serviceIds) ? body.serviceIds : []
  const validServices = await prisma.bookingType.findMany({
    where: { id: { in: requestedIds }, accountId },
    select: { id: true },
  })
  const serviceIds = validServices.map((s) => s.id)

  let availableHours = '{}'
  if (typeof body.availableHours === 'string') {
    try { JSON.parse(body.availableHours); availableHours = body.availableHours } catch { /* keep default */ }
  }
  const bookable = Boolean(body.bookable)

  await prisma.bookingStaffProfile.upsert({
    where: { accountId_userId: { accountId, userId } },
    create: { accountId, userId, bookable, availableHours, services: { connect: serviceIds.map((id) => ({ id })) } },
    update: { bookable, availableHours, services: { set: serviceIds.map((id) => ({ id })) } },
  })

  return NextResponse.json({ ok: true })
}
