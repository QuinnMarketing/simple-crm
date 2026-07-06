import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { syncAudienceToMeta, syncAudienceToGoogle } from '@/lib/ads/audience-builder'

type P = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: P) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const audience = await prisma.adAudience.findUnique({ where: { id } })
  if (!audience) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
  if (session.user.role !== 'master_admin' && !userAccountIds.includes(audience.accountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (audience.platform === 'meta_ads') {
      await syncAudienceToMeta(id)
    } else if (audience.platform === 'google_ads') {
      await syncAudienceToGoogle(id)
    } else {
      return NextResponse.json({ error: 'Platform not supported for audience upload' }, { status: 400 })
    }

    const updated = await prisma.adAudience.findUnique({ where: { id } })
    return NextResponse.json({ audience: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
